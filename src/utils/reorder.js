// Reorder only the supplied IDs, preserving hidden records and their positions.
export function mergeBookOrder(books, orderedBooks) {
  const byId = new Map(books.map((book) => [book.id, book]));
  const ids = orderedBooks.map((book) => book.id);
  if (new Set(ids).size !== ids.length || ids.some((id) => !byId.has(id))) {
    throw new Error('The library changed. Please try arranging it again.');
  }
  const selected = new Set(ids);
  let next = 0;
  return books.map((book) => selected.has(book.id) ? byId.get(ids[next++]) : book);
}

export function moveBookTo(books, fromId, toId) {
  const from = books.findIndex((book) => book.id === fromId);
  const to = books.findIndex((book) => book.id === toId);
  if (from < 0 || to < 0 || from === to) return books;
  const updated = [...books];
  const [book] = updated.splice(from, 1);
  updated.splice(to, 0, book);
  return updated;
}

// Use actual untransformed slot bounds; a canceled/outside drop is a no-op.
export function findDropTarget(slots, x, y, shelves = []) {
  // A shelf includes its empty space and ledge, not just its book spines.
  // Restrict candidates to that shelf so shorter books remain easy to target.
  const shelf = shelves.find((row) => x >= row.x && x <= row.x + row.width
    && y >= row.y && y <= row.y + row.height);
  if (shelf) {
    const candidates = slots.filter((slot) => shelf.bookIds.includes(slot.id));
    if (!candidates.length) return null;
    return candidates.reduce((nearest, slot) => (
      Math.abs(x - (slot.x + slot.width / 2)) < Math.abs(x - (nearest.x + nearest.width / 2))
        ? slot : nearest
    )).id;
  }
  const rows = slots.filter((slot) => y >= slot.y && y <= slot.y + slot.height);
  if (!rows.length) return null;
  const left = Math.min(...rows.map((slot) => slot.x));
  const right = Math.max(...rows.map((slot) => slot.x + slot.width));
  if (x < left || x > right) return null;
  return rows.reduce((nearest, slot) => (
    Math.abs(x - (slot.x + slot.width / 2)) < Math.abs(x - (nearest.x + nearest.width / 2))
      ? slot : nearest
  )).id;
}
