# Flow · Kanban Board

A drag-and-drop Kanban board that works with a mouse, on touch screens and with the keyboard. Everything saves in your browser.

**Live:** https://cryoviper.github.io/kanban-board/

## Features

- Drag cards between columns and reorder them (custom Pointer Events drag and drop, so it works on phones too: press and hold to pick up a card)
- Keyboard support: focus a card, `Enter` to edit, `Alt + ←/→` to move between columns, `Alt + ↑/↓` to reorder
- Add, rename and delete columns; add cards inline
- Edit cards in a native `<dialog>`: title, notes, label and due date, with overdue highlighting
- Search and label filter
- Undo for deleted cards and columns
- Export and import the board as JSON
- Auto-saves to `localStorage`; light and dark mode

## Tech

- Vanilla JavaScript (ES modules), HTML, CSS. No libraries, no build step.
- Pointer Events + `elementFromPoint` for drag and drop, with auto-scroll near edges
- All user text is rendered with `textContent` (no `innerHTML`), so pasted HTML can't run

## Run locally

```bash
git clone https://github.com/cryoviper/kanban-board.git
cd kanban-board
npx serve .
```

## What I learned

- Building drag and drop from scratch instead of using the HTML5 DnD API (which doesn't work on touch)
- Keeping a single source of truth (the board object) and re-rendering from it
- Accessible keyboard alternatives for drag-only interactions
- Validating imported data before trusting it

---

Built by [Praveen Sinwar](https://github.com/cryoviper).
