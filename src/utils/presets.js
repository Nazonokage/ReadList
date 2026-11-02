export function preparePreset(preset) {
  const name = String(preset.name || '').trim();
  if (!name) throw new Error('Enter a preset name.');
  return {
    id: preset.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name,
    bookIds: [...new Set(preset.bookIds || [])],
    statuses: [...new Set(preset.statuses || [])],
    categories: [...new Set(preset.categories || [])],
    query: String(preset.query || '').trim(),
  };
}

export function applyPreset(books, preset) {
  if (!preset) return books;
  const lower = (text) => String(text || '').toLocaleLowerCase();
  const wantedIds = new Set(preset.bookIds);
  const categories = preset.categories.map(lower);
  const filtered = books.filter((book) => (
    (!wantedIds.size || wantedIds.has(book.id)) &&
    (!preset.statuses.length || preset.statuses.includes(book.status)) &&
    (!categories.length || (book.subgenres || '').split(',').some((tag) => categories.includes(lower(tag.trim())))) &&
    (!preset.query || lower([book.book, book.author, book.subgenres, book.notes].join(' ')).includes(lower(preset.query)))
  ));
  if (!wantedIds.size) return filtered;
  const order = new Map(preset.bookIds.map((id, index) => [id, index]));
  return [...filtered].sort((a, b) => order.get(a.id) - order.get(b.id));
}
