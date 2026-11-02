import { unzipSync, strFromU8 } from 'fflate';
import { DOMParser } from '@xmldom/xmldom';
// The explicit CommonJS entry avoids tslib 1.x's broken ESM wrapper in Metro.
import * as PDFLib from 'pdf-lib/cjs/index.js';

export const METADATA_SIZE_LIMIT = 25 * 1024 * 1024;

export function documentFormat(name) {
  const format = String(name || '').split('.').pop().toUpperCase();
  if (!['PDF', 'EPUB'].includes(format)) throw new Error('Choose a PDF or EPUB file.');
  return format;
}

export function filenameTitle(name) {
  return String(name).replace(/\.(pdf|epub)$/i, '').replace(/[_-]+/g, ' ').trim() || 'Untitled book';
}

function xmlDocument(text) {
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error('Unsupported XML declaration.');
  return new DOMParser().parseFromString(text, 'application/xml');
}

export async function readDocumentMetadata(bytes, name) {
  const format = documentFormat(name);
  const result = { book: filenameTitle(name), author: '', pages: 0, subgenres: '', type: format, warning: '' };
  if (!bytes || bytes.byteLength > METADATA_SIZE_LIMIT) {
    return { ...result, warning: 'Large file: using its filename. You can enter the details below.' };
  }
  try {
    if (format === 'PDF') {
      const pdf = await PDFLib.PDFDocument.load(bytes, { updateMetadata: false });
      result.book = pdf.getTitle()?.trim() || result.book;
      result.author = pdf.getAuthor()?.trim() || '';
      result.pages = pdf.getPageCount();
      result.subgenres = (pdf.getKeywords() || '').trim();
    } else {
      let entries = 0;
      const files = unzipSync(bytes, { filter: (entry) => {
        if (++entries > 5000) throw new Error('Too many archive entries.');
        return entry.originalSize <= 512 * 1024 && (entry.name === 'META-INF/container.xml' || entry.name.endsWith('.opf'));
      } });
      const container = files['META-INF/container.xml'];
      if (!container) throw new Error('Missing EPUB container.');
      const rootfile = xmlDocument(strFromU8(container)).getElementsByTagName('rootfile')[0];
      const path = rootfile?.getAttribute('full-path');
      if (!path || !files[path]) throw new Error('Missing EPUB metadata.');
      const doc = xmlDocument(strFromU8(files[path]));
      const text = (tag) => Array.from(doc.getElementsByTagNameNS('*', tag)).map((node) => node.textContent.trim()).filter(Boolean);
      result.book = text('title')[0] || result.book;
      result.author = text('creator').join(', ');
      result.subgenres = text('subject').join(', ');
    }
    if (!result.author) result.warning = 'Some metadata is missing. Review or enter the details below.';
  } catch {
    result.warning = 'Metadata could not be read. You can enter the details manually; the selected file will still be attached.';
  }
  return result;
}
