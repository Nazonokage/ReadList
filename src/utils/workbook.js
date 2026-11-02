// ReadList workbook exchange.
//
// Writes and reads a real .xlsx (a zip of SpreadsheetML parts) without adding a
// spreadsheet dependency: fflate builds the zip and @xmldom/xmldom reads it, both
// of which the app already ships for the EPUB reader. Records are split across
// Books, Series and Movies so pages and episodes are never mixed in one column,
// and reading positions travel in a separate Progress sheet.
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
import { DOMParser } from '@xmldom/xmldom';
import { mediaKind } from './progress.js';

export const WORKBOOK_APP = 'ReadList';
export const WORKBOOK_VERSION = 1;

const COLUMNS = {
  ReadList: ['key', 'value'],
  Books: ['id', 'title', 'author', 'status', 'categories', 'format', 'pages', 'started', 'finished', 'rating', 'spice', 'notes', 'attachment_name', 'attachment_format', 'sort_order', 'example'],
  Series: ['id', 'title', 'creator', 'status', 'categories', 'format', 'episodes', 'current_episode', 'started', 'finished', 'rating', 'spice', 'notes', 'attachment_name', 'attachment_format', 'sort_order', 'example'],
  Movies: ['id', 'title', 'creator', 'status', 'categories', 'format', 'started', 'finished', 'rating', 'spice', 'notes', 'sort_order', 'example'],
  Progress: ['item_id', 'format', 'location', 'scroll', 'updated_at'],
};

// Columns that may appear under a different name in a hand-edited workbook.
const ALIASES = {
  author: ['author', 'creator', 'writer'],
  creator: ['creator', 'author', 'director', 'writer'],
  title: ['title', 'name', 'book'],
  categories: ['categories', 'category', 'tags', 'genres', 'subgenres'],
  format: ['format', 'type', 'kind'],
  rating: ['rating', 'rate'],
  spice: ['spice', 'spicy', 'spicy_level'],
  pages: ['pages', 'page_count', 'total_pages'],
  episodes: ['episodes', 'total_episodes'],
  current_episode: ['current_episode', 'episode', 'current'],
  started: ['started', 'start_date', 'startdate'],
  finished: ['finished', 'end_date', 'enddate', 'completed'],
  attachment_name: ['attachment_name', 'file', 'filename', 'file_name'],
  attachment_format: ['attachment_format', 'file_format'],
  sort_order: ['sort_order', 'order', 'position'],
  example: ['example', 'is_sample', 'sample'],
  item_id: ['item_id', 'id'],
  location: ['location', 'locator', 'chapter', 'chapter_id'],
};

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function columnName(index) {
  let name = '';
  let value = index + 1;
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
}

function columnIndex(reference) {
  const match = /^([A-Z]+)/i.exec(reference || '');
  if (!match) return -1;
  let index = 0;
  for (const letter of match[1].toUpperCase()) index = index * 26 + (letter.charCodeAt(0) - 64);
  return index - 1;
}

function cellXml(value, reference) {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'boolean') return `<c r="${reference}" t="b"><v>${value ? 1 : 0}</v></c>`;
  if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${reference}"><v>${value}</v></c>`;
  return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

function sheetXml(rows) {
  const body = rows.map((row, rowIndex) => {
    const cells = row.map((value, column) => cellXml(value, `${columnName(column)}${rowIndex + 1}`)).join('');
    return cells ? `<row r="${rowIndex + 1}">${cells}</row>` : '';
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
}

// Builds a workbook from [{ name, rows }]. The first row is treated as the header.
export function buildWorkbook(sheets) {
  if (!Array.isArray(sheets) || !sheets.length) throw new Error('A workbook needs at least one sheet.');
  const used = new Set();
  const parts = {};
  const contentTypes = [];
  const workbookSheets = [];
  const relationships = [];
  sheets.forEach((sheet, index) => {
    const name = String(sheet.name || `Sheet${index + 1}`).slice(0, 31);
    if (used.has(name.toLowerCase())) throw new Error(`The workbook has two sheets named "${name}".`);
    used.add(name.toLowerCase());
    const path = `worksheets/sheet${index + 1}.xml`;
    parts[`xl/${path}`] = strToU8(sheetXml(sheet.rows || []));
    contentTypes.push(`<Override PartName="/xl/${path}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`);
    workbookSheets.push(`<sheet name="${escapeXml(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`);
    relationships.push(`<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="${path}"/>`);
  });
  const stylesRel = `rId${sheets.length + 1}`;
  relationships.push(`<Relationship Id="${stylesRel}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`);

  parts['[Content_Types].xml'] = strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${contentTypes.join('')}</Types>`);
  parts['_rels/.rels'] = strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  parts['xl/workbook.xml'] = strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${workbookSheets.join('')}</sheets></workbook>`);
  parts['xl/_rels/workbook.xml.rels'] = strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships.join('')}</Relationships>`);
  parts['xl/styles.xml'] = strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><dxfs count="0"/><tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/></styleSheet>`);
  return zipSync(parts, { level: 6 });
}

function parseXml(xml, label) {
  const errors = [];
  const doc = new DOMParser({ onError: (level, message) => { if (level === 'error' || level === 'fatalError') errors.push(message); } }).parseFromString(xml, 'text/xml');
  if (!doc || !doc.documentElement || errors.length) throw new Error(`The workbook's ${label} part could not be parsed.`);
  return doc;
}

function textOf(element) {
  const texts = element.getElementsByTagName('t');
  let value = '';
  for (let index = 0; index < texts.length; index += 1) value += texts[index].textContent || '';
  return value;
}

function sharedStrings(xml) {
  if (!xml) return [];
  const doc = parseXml(xml, 'shared strings');
  const items = doc.getElementsByTagName('si');
  const values = [];
  for (let index = 0; index < items.length; index += 1) values.push(textOf(items[index]));
  return values;
}

function readCell(cell, shared) {
  const type = cell.getAttribute('t');
  if (type === 'inlineStr') {
    const inline = cell.getElementsByTagName('is');
    return inline.length ? textOf(inline[0]) : '';
  }
  const valueNode = cell.getElementsByTagName('v')[0];
  const raw = valueNode ? valueNode.textContent || '' : '';
  if (type === 's') {
    const index = Number(raw);
    return Number.isInteger(index) ? shared[index] ?? '' : '';
  }
  if (type === 'str' || type === 'e') return raw;
  if (type === 'b') return raw === '1';
  if (raw === '') return '';
  const number = Number(raw);
  return Number.isFinite(number) ? number : raw;
}

function parseSheet(xml, shared) {
  const doc = parseXml(xml, 'worksheet');
  const rows = [];
  const rowNodes = doc.getElementsByTagName('row');
  for (let index = 0; index < rowNodes.length; index += 1) {
    const rowNode = rowNodes[index];
    const cells = [];
    const cellNodes = rowNode.getElementsByTagName('c');
    for (let cellIndex = 0; cellIndex < cellNodes.length; cellIndex += 1) {
      const cell = cellNodes[cellIndex];
      const position = columnIndex(cell.getAttribute('r'));
      const target = position >= 0 ? position : cells.length;
      cells[target] = readCell(cell, shared);
    }
    const rowCells = Array.from(cells, (value) => (value === undefined ? '' : value));
    const declared = Number(rowNode.getAttribute('r'));
    if (Number.isInteger(declared) && declared > 0) rows[declared - 1] = rowCells;
    else rows.push(rowCells);
  }
  for (let index = 0; index < rows.length; index += 1) if (!rows[index]) rows[index] = [];
  while (rows.length && rows[rows.length - 1].every((value) => value === '')) rows.pop();
  return rows;
}

export function parseWorkbook(bytes) {
  let files;
  try { files = unzipSync(bytes); } catch { throw new Error('That file is not a readable .xlsx workbook.'); }
  const read = (path) => (files[path] ? strFromU8(files[path]) : null);
  const workbookXml = read('xl/workbook.xml');
  if (!workbookXml) throw new Error('That file is not a readable .xlsx workbook.');
  const workbookDoc = parseXml(workbookXml, 'workbook');
  const relsXml = read('xl/_rels/workbook.xml.rels') || '';
  const targets = {};
  if (relsXml) {
    const relsDoc = parseXml(relsXml, 'relationships');
    const rels = relsDoc.getElementsByTagName('Relationship');
    for (let index = 0; index < rels.length; index += 1) targets[rels[index].getAttribute('Id')] = rels[index].getAttribute('Target');
  }
  const shared = sharedStrings(read('xl/sharedStrings.xml'));
  const sheets = [];
  const sheetNodes = workbookDoc.getElementsByTagName('sheet');
  for (let index = 0; index < sheetNodes.length; index += 1) {
    const node = sheetNodes[index];
    const name = node.getAttribute('name') || `Sheet${index + 1}`;
    const relId = node.getAttribute('r:id') || node.getAttribute('id');
    const target = targets[relId];
    if (!target) throw new Error(`The sheet "${name}" is missing from the workbook.`);
    const path = target.startsWith('/') ? target.slice(1) : `xl/${target}`;
    const xml = read(path);
    if (!xml) throw new Error(`The sheet "${name}" could not be read.`);
    sheets.push({ name, rows: parseSheet(xml, shared) });
  }
  if (!sheets.length) throw new Error('The workbook has no sheets.');
  return { sheets };
}

function sheetRows(name, rows) {
  return { name, rows: [COLUMNS[name], ...rows] };
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
}

// Records → workbook sheets. Pages are only written for books and episode counts
// only for series, so a sheet can never imply the wrong unit.
export function libraryToWorkbook(books, positions = {}, exportedAt = new Date().toISOString()) {
  const rows = { Books: [], Series: [], Movies: [] };
  const progress = [];
  books.forEach((book, index) => {
    const kind = mediaKind(book.type);
    const base = [book.id, book.book || '', book.author || '', book.status || '', book.subgenres || '', book.type || '', book.startDate || '', book.endDate || '', numberOrZero(book.rate), numberOrZero(book.spicyLevel), book.notes || ''];
    const attachment = [book.attachmentName || '', book.attachmentFormat || ''];
    const order = Number.isFinite(Number(book.sortOrder)) ? Number(book.sortOrder) : index;
    const example = book.isSample ? 'yes' : '';
    if (kind === 'series') {
      rows.Series.push([book.id, book.book || '', book.author || '', book.status || '', book.subgenres || '', book.type || '', numberOrZero(book.episodes) || numberOrZero(book.pages), numberOrZero(book.currentEpisode), book.startDate || '', book.endDate || '', numberOrZero(book.rate), numberOrZero(book.spicyLevel), book.notes || '', ...attachment, order, example]);
    } else if (kind === 'movie') {
      rows.Movies.push([base[0], base[1], base[2], base[3], base[4], base[5], base[6], base[7], base[8], base[9], base[10], order, example]);
    } else {
      rows.Books.push([base[0], base[1], base[2], base[3], base[4], base[5], numberOrZero(book.pages), base[6], base[7], base[8], base[9], base[10], ...attachment, order, example]);
    }
    const position = positions[String(book.id)];
    if (position) {
      const location = position.chapterId || (position.page ? `page ${position.page}` : '');
      progress.push([book.id, position.format || book.attachmentFormat || '', location, Number(position.scroll) || 0, position.updatedAt || '']);
    }
  });
  return [
    { name: 'ReadList', rows: [COLUMNS.ReadList, ['app', WORKBOOK_APP], ['schema_version', WORKBOOK_VERSION], ['exported_at', exportedAt], ['note', 'Progress rows are current reading positions, not a history. Original PDF/EPUB files are not included.']] },
    sheetRows('Books', rows.Books),
    sheetRows('Series', rows.Series),
    sheetRows('Movies', rows.Movies),
    sheetRows('Progress', progress),
  ];
}

function normalizeHeader(value) {
  return String(value).trim().toLowerCase().replace(/\s+/g, '_');
}

// Maps a sheet's header row to column indexes, accepting the aliases above.
function headerMap(headerRow) {
  const normalized = headerRow.map(normalizeHeader);
  const map = {};
  for (const [field, aliases] of Object.entries(ALIASES)) {
    const found = normalized.findIndex((name) => aliases.includes(name));
    if (found >= 0) map[field] = found;
  }
  map.id = normalized.findIndex((name) => name === 'id');
  map.title = map.title ?? normalized.findIndex((name) => name === 'title' || name === 'name');
  map.status = normalized.findIndex((name) => name === 'status');
  map.notes = normalized.findIndex((name) => name === 'notes' || name === 'note');
  map.format = map.format ?? normalized.findIndex((name) => name === 'format' || name === 'type');
  map.scroll = normalized.findIndex((name) => name === 'scroll' || name === 'offset');
  map.updated_at = normalized.findIndex((name) => name === 'updated_at' || name === 'updated' || name === 'modified');
  return map;
}

function cell(row, index) {
  if (index === undefined || index < 0) return '';
  return row[index] === undefined || row[index] === null ? '' : row[index];
}

function text(row, index) {
  const value = cell(row, index);
  return typeof value === 'string' ? value.trim() : String(value ?? '').trim();
}

function ratio(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : 0;
}

export function workbookToLibrary(parsed) {
  const byName = new Map(parsed.sheets.map((sheet) => [sheet.name.trim().toLowerCase(), sheet]));
  const meta = byName.get('readlist');
  if (meta) {
    const app = meta.rows.slice(1).find((row) => String(row[0]).trim() === 'app');
    if (app && String(app[1]).trim() !== WORKBOOK_APP) throw new Error('That workbook was not exported by ReadList.');
  }
  const books = [];
  const issues = [];
  const seen = new Set();
  const addSheet = (name, kindDefault, sheetName) => {
    const sheet = byName.get(sheetName);
    if (!sheet || sheet.rows.length < 2) return;
    const map = headerMap(sheet.rows[0]);
    if (map.id < 0) throw new Error(`The ${name} sheet has no id column.`);
    if (map.title === undefined || map.title < 0) throw new Error(`The ${name} sheet has no title column.`);
    sheet.rows.slice(1).forEach((row, index) => {
      const rowNumber = index + 2;
      const id = cell(row, map.id);
      const title = text(row, map.title);
      if (id === '' && title === '') return; // blank spacer row
      if (id === '') { issues.push(`${name} row ${rowNumber} has no id and was skipped.`); return; }
      if (!title) { issues.push(`${name} row ${rowNumber} has no title and was skipped.`); return; }
      const key = String(id);
      if (seen.has(key)) { issues.push(`${name} row ${rowNumber} repeats the id ${key}; the later row was skipped.`); return; }
      seen.add(key);
      const format = text(row, map.format) || kindDefault;
      const kind = mediaKind(format);
      const record = {
        id,
        book: title,
        author: text(row, map.author ?? map.creator),
        status: text(row, map.status) || 'Want to Read',
        subgenres: text(row, map.categories),
        type: format,
        pages: kind === 'series' ? 0 : numberOrZero(cell(row, map.pages)),
        episodes: kind === 'series' ? numberOrZero(cell(row, map.episodes)) : 0,
        currentEpisode: kind === 'series' ? numberOrZero(cell(row, map.current_episode)) : 0,
        startDate: text(row, map.started),
        endDate: text(row, map.finished),
        rate: numberOrZero(cell(row, map.rating)),
        spicyLevel: numberOrZero(cell(row, map.spice)),
        notes: text(row, map.notes),
        attachmentName: text(row, map.attachment_name),
        attachmentFormat: text(row, map.attachment_format),
        isSample: /^(yes|true|1|y)$/i.test(text(row, map.example)) ? 1 : 0,
        sortOrder: Number.isFinite(Number(cell(row, map.sort_order))) && String(cell(row, map.sort_order)).trim() !== '' ? Number(cell(row, map.sort_order)) : books.length,
      };
      books.push(record);
    });
  };
  addSheet('Books', 'Paperback', 'books');
  addSheet('Series', 'Anime Series', 'series');
  addSheet('Movies', 'Movie', 'movies');
  if (!books.length && byName.size === 1) throw new Error('The workbook has no Books, Series or Movies sheet.');
  if (!books.length) throw new Error('The workbook has no readable rows.');

  const positions = {};
  const progressSheet = byName.get('progress');
  if (progressSheet && progressSheet.rows.length > 1) {
    const map = headerMap(progressSheet.rows[0]);
    progressSheet.rows.slice(1).forEach((row) => {
      const itemId = cell(row, map.item_id);
      if (itemId === '') return;
      const location = text(row, map.location);
      const format = text(row, map.format).toUpperCase();
      const page = Number(/page\s*(\d+)/i.exec(location)?.[1]);
      positions[String(itemId)] = {
        format: format === 'PDF' || format === 'EPUB' ? format : undefined,
        chapterId: format === 'EPUB' ? location : undefined,
        page: format === 'PDF' && Number.isInteger(page) && page > 0 ? page : undefined,
        scroll: ratio(cell(row, map.scroll)),
        updatedAt: text(row, map.updated_at) || undefined,
      };
    });
  }
  return { books, positions, issues };
}

export function summarizeWorkbook(parsed) {
  const { books, positions, issues } = workbookToLibrary(parsed);
  const counts = { book: 0, series: 0, movie: 0 };
  for (const record of books) counts[mediaKind(record.type)] += 1;
  return { total: books.length, ...counts, positions: Object.keys(positions).length, issues: issues.length, records: books, readingPositions: positions, problems: issues };
}
