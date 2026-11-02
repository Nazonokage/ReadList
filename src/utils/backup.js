// Backup file validation, shared by the native and browser storage layers so a
// hand-edited or truncated backup is rejected before anything is written.

export const BACKUP_APP = 'ReadList';
export const BACKUP_VERSION = 1;

const TEXT_FIELDS = ['book', 'author', 'status', 'subgenres', 'type', 'startDate', 'endDate', 'color', 'notes', 'attachmentUri', 'attachmentName', 'attachmentFormat'];
const NUMBER_FIELDS = ['pages', 'rate', 'spicyLevel', 'episodes', 'currentEpisode'];

function text(value) {
  if (value === undefined || value === null) return '';
  return typeof value === 'string' ? value : String(value);
}

function count(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
}

export function normalizeBackupRecord(book, index = 0) {
  const record = { id: book.id, isSample: book.isSample ? 1 : 0, sortOrder: index };
  for (const field of TEXT_FIELDS) record[field] = text(book[field]);
  record.book = record.book.trim();
  for (const field of NUMBER_FIELDS) record[field] = count(book[field]);
  return record;
}

function validatePresets(presets) {
  if (!Array.isArray(presets)) return [];
  return presets.filter((preset) => preset && typeof preset === 'object' && typeof preset.name === 'string' && preset.name.trim() && preset.id !== undefined && preset.id !== null)
    .map((preset) => ({ ...preset, id: String(preset.id), name: preset.name.trim() }));
}

function validatePositions(positions) {
  if (!positions || typeof positions !== 'object' || Array.isArray(positions)) return {};
  const result = {};
  for (const [bookId, position] of Object.entries(positions)) {
    if (!position || typeof position !== 'object' || Array.isArray(position)) continue;
    result[String(bookId)] = position;
  }
  return result;
}

export function validateBackup(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throw new Error('That file is not a ReadList backup.');
  }
  if (snapshot.app !== undefined && snapshot.app !== BACKUP_APP) {
    throw new Error('That backup was made by a different app.');
  }
  if (!Array.isArray(snapshot.books)) {
    throw new Error('The backup does not contain a library.');
  }
  const seen = new Set();
  const books = snapshot.books.map((book, index) => {
    if (!book || typeof book !== 'object' || Array.isArray(book)) {
      throw new Error(`Record ${index + 1} in the backup is not a library entry.`);
    }
    if (typeof book.book !== 'string' || !book.book.trim()) {
      throw new Error(`Record ${index + 1} in the backup has no title.`);
    }
    if (book.id === undefined || book.id === null || book.id === '') {
      throw new Error(`Record ${index + 1} in the backup has no ID.`);
    }
    const id = String(book.id);
    if (seen.has(id)) throw new Error(`The backup contains the ID ${id} more than once.`);
    seen.add(id);
    return normalizeBackupRecord(book, index);
  });
  const shelfCount = Number(snapshot.shelfSettings?.shelfCount);
  return {
    books,
    presets: validatePresets(snapshot.presets),
    readingPositions: validatePositions(snapshot.readingPositions),
    shelfSettings: { shelfCount: Number.isInteger(shelfCount) && shelfCount >= 1 && shelfCount <= 20 ? shelfCount : 3 },
    readerPreferences: { showProgress: !!snapshot.readerPreferences?.showProgress },
  };
}

export function describeBackup(backup) {
  const examples = backup.books.filter((book) => book.isSample).length;
  const own = backup.books.length - examples;
  return `${own} ${own === 1 ? 'title' : 'titles'}${examples ? ` and ${examples} example ${examples === 1 ? 'title' : 'titles'}` : ''}, ${Object.keys(backup.readingPositions).length} saved reading ${Object.keys(backup.readingPositions).length === 1 ? 'position' : 'positions'}, ${backup.presets.length} ${backup.presets.length === 1 ? 'preset' : 'presets'}`;
}
