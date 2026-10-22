// Flow: Kanban board with pointer-based drag and drop (mouse + touch) and keyboard moves.
// All user text is rendered with textContent, never innerHTML.

const KEY = "flow.board.v1";
const LABELS = { design: "Design", dev: "Dev", bug: "Bug", research: "Research" };
const uid = () => Math.random().toString(36).slice(2, 10);

const sample = () => ({
  name: "Portfolio launch",
  columns: [
    { id: uid(), title: "To do", cards: [
      { id: uid(), title: "Write project READMEs", notes: "Add live links, features and what I learned.", label: "research", due: "" },
      { id: uid(), title: "Fix mobile nav overflow", notes: "Menu button wraps under the logo at 360px.", label: "bug", due: offsetDate(1) },
      { id: uid(), title: "Design dark mode tokens", notes: "", label: "design", due: "" },
    ]},
    { id: uid(), title: "In progress", cards: [
      { id: uid(), title: "Kanban drag and drop", notes: "Pointer events so it works with touch too.", label: "dev", due: offsetDate(3) },
    ]},
    { id: uid(), title: "Done", cards: [
      { id: uid(), title: "Set up GitHub Pages", notes: "", label: "dev", due: "" },
    ]},
  ],
});
function offsetDate(days) {
  const d = new Date(); d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ---------- state ----------
let board = load() || sample();
let filter = { q: "", label: "" };
let lastDeleted = null;

function load() {
  try {
    const b = JSON.parse(localStorage.getItem(KEY));
    return valid(b) ? b : null;
  } catch { return null; }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(board)); } catch { /* storage full or blocked */ }
}
function valid(b) {
  return b && typeof b.name === "string" && Array.isArray(b.columns) &&
    b.columns.every((c) => typeof c.title === "string" && Array.isArray(c.cards));
}
const findCard = (id) => {
  for (const col of board.columns) {
    const i = col.cards.findIndex((c) => c.id === id);
    if (i > -1) return { col, i, card: col.cards[i] };
  }
  return null;
};

// ---------- render ----------
const boardEl = document.getElementById("board");
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const svg = (d) => {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", "0 0 24 24");
  s.setAttribute("aria-hidden", "true");
  s.innerHTML = d; // static markup only
  return s;
};

function render() {
  document.getElementById("boardName").value = board.name;
  boardEl.replaceChildren();
  const q = filter.q.toLowerCase();
  const match = (c) =>
    (!q || c.title.toLowerCase().includes(q) || (c.notes || "").toLowerCase().includes(q)) &&
    (!filter.label || c.label === filter.label);

  board.columns.forEach((col) => {
    const section = el("section", "col");
    section.dataset.col = col.id;
    section.setAttribute("aria-label", col.title);

    const head = el("div", "col-head");
    const title = el("input");
    title.value = col.title;
    title.maxLength = 30;
    title.setAttribute("aria-label", "Column name");
    title.addEventListener("change", () => { col.title = title.value.trim() || "Untitled"; save(); render(); });
    const visible = col.cards.filter(match);
    const count = el("span", "count", filter.q || filter.label ? `${visible.length}/${col.cards.length}` : String(col.cards.length));
    const del = el("button", "icon-btn");
    del.type = "button";
    del.title = "Delete column";
    del.setAttribute("aria-label", `Delete column ${col.title}`);
    del.append(svg('<path d="M5 7h14M10 11v6M14 11v6M7 7l1 12h8l1-12M9 7V4h6v3"/>'));
    del.addEventListener("click", () => deleteColumn(col.id));
    head.append(title, count, del);

    const list = el("ul", "list");
    list.dataset.col = col.id;
    if (!visible.length) list.append(el("li", "empty", col.cards.length ? "No matching cards" : "Drop cards here"));
    visible.forEach((card) => list.append(cardEl(card)));

    section.append(head, list, addCardUI(col));
    boardEl.append(section);
  });

  const nc = el("button", "new-col", "+ Add column");
  nc.type = "button";
  nc.addEventListener("click", () => {
    board.columns.push({ id: uid(), title: "New column", cards: [] });
    save(); render();
    boardEl.querySelector(".col:last-of-type .col-head input")?.select();
  });
  boardEl.append(nc);
  refreshLabelFilter();
}

function cardEl(card) {
  const li = el("li", "card");
  li.dataset.id = card.id;
  li.tabIndex = 0;
  li.setAttribute("aria-label", `${card.title}${card.label ? ", label " + LABELS[card.label] : ""}. Press Enter to edit, Alt plus arrows to move.`);
  li.append(el("h3", null, card.title));
  if (card.notes) li.append(el("p", null, card.notes));
  if (card.label || card.due) {
    const meta = el("div", "card-meta");
    if (card.label) meta.append(el("span", `tag ${card.label}`, LABELS[card.label]));
    if (card.due) {
      const late = card.due < new Date().toISOString().slice(0, 10);
      const d = el("span", "due" + (late ? " late" : ""));
      d.textContent = (late ? "Overdue · " : "Due ") + new Date(card.due + "T00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
      meta.append(d);
    }
    li.append(meta);
  }
  li.addEventListener("keydown", (e) => onCardKey(e, card.id));
  li.addEventListener("click", () => { if (!dragJustEnded) openEditor(card.id); });
  li.addEventListener("pointerdown", (e) => startPress(e, li));
  return li;
}

function addCardUI(col) {
  const wrap = el("div");
  const btn = el("button", "add-btn", "+ Add a card");
  btn.type = "button";
  btn.addEventListener("click", () => {
    const form = el("form", "add-form");
    const ta = el("textarea");
    ta.placeholder = "What needs doing?";
    ta.maxLength = 120;
    ta.setAttribute("aria-label", "New card title");
    const row = el("div", "row");
    const ok = el("button", "btn primary", "Add card");
    const cancel = el("button", "btn ghost", "Cancel");
    cancel.type = "button";
    row.append(ok, cancel);
    form.append(ta, row);
    wrap.replaceChildren(form);
    ta.focus();
    const submit = () => {
      const title = ta.value.trim();
      if (title) {
        col.cards.push({ id: uid(), title, notes: "", label: "", due: "" });
        save(); render();
        boardEl.querySelector(`.col[data-col="${col.id}"] .add-btn`)?.click();
      }
    };
    form.addEventListener("submit", (e) => { e.preventDefault(); submit(); });
    ta.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
      if (e.key === "Escape") render();
    });
    cancel.addEventListener("click", render);
  });
  wrap.append(btn);
  return wrap;
}

function deleteColumn(id) {
  const i = board.columns.findIndex((c) => c.id === id);
  const col = board.columns[i];
  if (!col) return;
  board.columns.splice(i, 1);
  lastDeleted = { type: "col", col, i };
  save(); render();
  toast(`Deleted "${col.title}"${col.cards.length ? ` and ${col.cards.length} cards` : ""}`, true);
}

// ---------- keyboard moves ----------
function onCardKey(e, id) {
  if (e.key === "Enter") { e.preventDefault(); return openEditor(id); }
  if (!e.altKey) return;
  const found = findCard(id);
  if (!found) return;
  const ci = board.columns.indexOf(found.col);
  let target = null;
  if (e.key === "ArrowUp" && found.i > 0) target = { col: found.col, i: found.i - 1 };
  if (e.key === "ArrowDown" && found.i < found.col.cards.length - 1) target = { col: found.col, i: found.i + 1 };
  if (e.key === "ArrowLeft" && ci > 0) target = { col: board.columns[ci - 1], i: board.columns[ci - 1].cards.length };
  if (e.key === "ArrowRight" && ci < board.columns.length - 1) target = { col: board.columns[ci + 1], i: board.columns[ci + 1].cards.length };
  if (!target) return;
  e.preventDefault();
  const [card] = found.col.cards.splice(found.i, 1);
  target.col.cards.splice(target.i, 0, card);
  save(); render();
  const n = boardEl.querySelector(`.card[data-id="${id}"]`);
  n?.focus();
  toast(`Moved to ${target.col.title}`);
}

// ---------- pointer drag and drop ----------
let drag = null, pressTimer = null, dragJustEnded = false;

function startPress(e, li) {
  if (e.button !== 0) return;
  const start = { x: e.clientX, y: e.clientY };
  const isTouch = e.pointerType === "touch";
  let started = false;

  const begin = (ev) => {
    started = true;
    const r = li.getBoundingClientRect();
    const ghost = li.cloneNode(true);
    ghost.classList.add("ghost-card");
    ghost.style.width = r.width + "px";
    document.body.append(ghost);
    const ph = el("li", "placeholder");
    ph.style.height = r.height + "px";
    li.after(ph);
    li.classList.add("dim");
    li.style.display = "none";
    drag = { id: li.dataset.id, li, ghost, ph, dx: start.x - r.left, dy: start.y - r.top };
    moveGhost(ev.clientX, ev.clientY);
    if (navigator.vibrate && isTouch) navigator.vibrate(10);
  };

  const onMove = (ev) => {
    if (!started) {
      const dist = Math.hypot(ev.clientX - start.x, ev.clientY - start.y);
      if (isTouch) { if (dist > 10) cleanup(); return; } // finger moved before long-press: let it scroll
      if (dist > 6) begin(ev);
      return;
    }
    ev.preventDefault();
    moveGhost(ev.clientX, ev.clientY);
    placeHolderAt(ev.clientX, ev.clientY);
    autoScroll(ev.clientX, ev.clientY);
  };
  const onUp = () => {
    if (started) drop();
    cleanup();
  };
  const noScroll = (ev) => { if (started) ev.preventDefault(); };
  const cleanup = () => {
    clearTimeout(pressTimer);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
    window.removeEventListener("touchmove", noScroll);
  };

  window.addEventListener("pointermove", onMove, { passive: false });
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
  window.addEventListener("touchmove", noScroll, { passive: false });
  if (isTouch) pressTimer = setTimeout(() => begin(e), 280);
}

function moveGhost(x, y) {
  drag.ghost.style.left = x - drag.dx + "px";
  drag.ghost.style.top = y - drag.dy + "px";
}

function placeHolderAt(x, y) {
  const under = document.elementFromPoint(x, y);
  const list = under?.closest(".list") || under?.closest(".col")?.querySelector(".list");
  if (!list) return;
  list.querySelector(".empty")?.remove();
  const cards = [...list.querySelectorAll(".card:not(.dim)")];
  const after = cards.find((c) => {
    const r = c.getBoundingClientRect();
    return y < r.top + r.height / 2;
  });
  if (after) list.insertBefore(drag.ph, after);
  else list.append(drag.ph);
}

function autoScroll(x, y) {
  const r = boardEl.getBoundingClientRect();
  if (x < r.left + 40) boardEl.scrollLeft -= 12;
  else if (x > r.right - 40) boardEl.scrollLeft += 12;
  const list = drag.ph.parentElement;
  if (list) {
    const lr = list.getBoundingClientRect();
    if (y < lr.top + 30) list.scrollTop -= 10;
    else if (y > lr.bottom - 30) list.scrollTop += 10;
  }
}

function drop() {
  const { id, ph, ghost } = drag;
  const list = ph.parentElement;
  const found = findCard(id);
  if (list && found) {
    const target = board.columns.find((c) => c.id === list.dataset.col);
    // index among *all* cards: place before the next visible sibling card
    let next = ph.nextElementSibling;
    while (next && !(next.classList.contains("card") && !next.classList.contains("dim"))) next = next.nextElementSibling;
    const [card] = found.col.cards.splice(found.i, 1);
    let idx = next ? target.cards.findIndex((c) => c.id === next.dataset.id) : -1;
    if (idx < 0) idx = target.cards.length;
    target.cards.splice(idx, 0, card);
    save();
  }
  ghost.remove();
  drag = null;
  dragJustEnded = true;
  setTimeout(() => (dragJustEnded = false), 50);
  render();
}

// ---------- editor dialog ----------
const dlg = document.getElementById("editor");
const form = document.getElementById("editorForm");
let editingId = null;

function openEditor(id) {
  const found = findCard(id);
  if (!found) return;
  editingId = id;
  form.elements.title.value = found.card.title;
  form.elements.notes.value = found.card.notes || "";
  form.elements.label.value = found.card.label || "";
  form.elements.due.value = found.card.due || "";
  dlg.showModal();
  form.elements.title.focus();
}
dlg.addEventListener("close", () => {
  if (dlg.returnValue === "save" && editingId) {
    const found = findCard(editingId);
    if (found) {
      Object.assign(found.card, {
        title: form.elements.title.value.trim() || found.card.title,
        notes: form.elements.notes.value.trim(),
        label: LABELS[form.elements.label.value] ? form.elements.label.value : "",
        due: form.elements.due.value,
      });
      save(); render();
    }
  }
  const id = editingId;
  editingId = null;
  boardEl.querySelector(`.card[data-id="${id}"]`)?.focus();
});
document.getElementById("deleteCard").addEventListener("click", () => {
  const found = findCard(editingId);
  if (!found) return;
  found.col.cards.splice(found.i, 1);
  lastDeleted = { type: "card", card: found.card, colId: found.col.id, i: found.i };
  save();
  dlg.close("deleted");
  render();
  toast("Card deleted", true);
});

// ---------- toolbar ----------
document.getElementById("boardName").addEventListener("change", (e) => {
  board.name = e.target.value.trim() || "My board";
  save();
});
document.getElementById("search").addEventListener("input", (e) => { filter.q = e.target.value.trim(); render(); });
document.getElementById("labelFilter").addEventListener("change", (e) => { filter.label = e.target.value; render(); });

function refreshLabelFilter() {
  const sel = document.getElementById("labelFilter");
  if (sel.options.length > 1) return;
  Object.entries(LABELS).forEach(([v, t]) => sel.append(new Option(t, v)));
}

const menuBtn = document.getElementById("menuBtn"), menu = document.getElementById("menu");
menuBtn.addEventListener("click", () => {
  menu.hidden = !menu.hidden;
  menuBtn.setAttribute("aria-expanded", String(!menu.hidden));
});
document.addEventListener("click", (e) => {
  if (!e.target.closest(".tools")) { menu.hidden = true; menuBtn.setAttribute("aria-expanded", "false"); }
});
menu.addEventListener("click", (e) => {
  const act = e.target.dataset.act;
  if (act === "export") {
    const blob = new Blob([JSON.stringify(board, null, 2)], { type: "application/json" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "flow-board.json" });
    a.click();
    URL.revokeObjectURL(a.href);
  }
  if (act === "reset") { board = sample(); save(); render(); toast("Sample board restored"); }
  if (act) menu.hidden = true;
});
document.getElementById("importFile").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!valid(data)) throw new Error("bad");
    data.columns.forEach((c) => { c.id ||= uid(); c.cards.forEach((k) => { k.id ||= uid(); k.title = String(k.title || "Untitled"); }); });
    board = data; save(); render(); toast("Board imported");
  } catch { toast("That file isn't a Flow board."); }
  e.target.value = "";
  menu.hidden = true;
});

// ---------- toast with undo ----------
let toastTimer;
function toast(msg, undo = false) {
  const t = document.getElementById("toast");
  t.replaceChildren(el("span", null, msg));
  if (undo) {
    const b = el("button", null, "Undo");
    b.type = "button";
    b.addEventListener("click", () => {
      if (lastDeleted?.type === "card") {
        const col = board.columns.find((c) => c.id === lastDeleted.colId) || board.columns[0];
        col?.cards.splice(lastDeleted.i, 0, lastDeleted.card);
      } else if (lastDeleted?.type === "col") {
        board.columns.splice(lastDeleted.i, 0, lastDeleted.col);
      }
      lastDeleted = null; save(); render(); t.hidden = true;
    });
    t.append(b);
  }
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 4500);
}

render();
