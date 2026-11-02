export const isSeries = (type = '') => /anime|series|episodes?/i.test(type) && !/movie|film/i.test(type);
export const isWatching = (type = '') => /anime|movie|film|documentary|tv series/i.test(type);

// One shared classification so insights can report pages for books and episodes for
// series without ever mixing the two units.
export function mediaKind(type = '') {
  if (isSeries(type)) return 'series';
  if (/movie|film|documentary/i.test(type)) return 'movie';
  return 'book';
}

// Keep the local time and its UTC offset together so exported dates stay unambiguous.
export function currentTimestamp(date = new Date()) {
  const offset = -date.getTimezoneOffset();
  const local = new Date(date.getTime() + offset * 60000).toISOString().slice(0, 19);
  const pad = (value) => String(Math.abs(value)).padStart(2, '0');
  return `${local}${offset >= 0 ? '+' : '-'}${pad(Math.trunc(offset / 60))}:${pad(offset % 60)}`;
}

export function statusDates(record, status, previousStatus, now = currentTimestamp()) {
  return {
    ...record,
    status,
    startDate: record.startDate || (['Currently Reading', 'Currently Watching', 'Completed'].includes(status) ? now : ''),
    endDate: record.endDate || (status === 'Completed' && previousStatus !== 'Completed' ? now : ''),
  };
}

export function displayTimestamp(value, fallback) {
  if (!value) return fallback;
  if (!value.includes('T')) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function episodeLabel(book, compact = false) {
  if (!isSeries(book.type)) return '';
  const current = Number(book.currentEpisode) || 0;
  const total = Number(book.episodes) || Number(book.pages) || 0;
  return current > 0 ? `${compact ? 'Ep.' : 'Current episode:'} ${current}${total ? ` / ${total}` : ''}` : 'Episode not set';
}
