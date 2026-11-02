import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';

test('native import retains the original granted URI and never copies, moves or deletes it', async () => {
  const pdf = await PDFDocument.create(); pdf.setTitle('Scoped file'); pdf.addPage();
  const bytes = await pdf.save();
  const events = [];
  let metadataFails = false;
  class File {
    constructor(uri) { this.uri = uri; this.name = 'book.pdf'; this.type = 'application/pdf'; }
    static async pickFileAsync() { return { canceled: false, result: new File('content://downloads/original-book') }; }
    get exists() { return true; } get size() { return bytes.length; }
    async copy() { throw new Error('Documents must never be copied'); }
    async bytes() { events.push(['read', this.uri]); if (this.uri !== 'content://downloads/original-book' || metadataFails) throw new Error('Missing READ permission'); return bytes; }
    delete() { throw new Error('Original documents must never be deleted'); }
  }
  globalThis.__readlistDocumentMocks = { File };
  let source = await readFile(new URL('../src/services/documentReferences.native.js', import.meta.url), 'utf8');
  source = source.replace("import { File } from 'expo-file-system';", 'const {File} = globalThis.__readlistDocumentMocks;')
    .replace("import { Platform } from 'react-native';", "const Platform = { OS: 'android' };")
    .replace("'../utils/documentMetadata'", JSON.stringify(new URL('../src/utils/documentMetadata.js', import.meta.url).href));
  const service = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const imported = await service.pickDocument();
  assert.equal(imported.metadata.book, 'Scoped file');
  assert.equal(events[0][0], 'read');
  assert.equal(imported.asset.uri, 'content://downloads/original-book');
  assert.equal((await service.persistDocument(imported.asset)).attachmentUri, imported.asset.uri);
  await service.removeDocument(imported.asset.uri);
  metadataFails = true;
  const fallback = await service.pickDocument();
  assert.match(fallback.metadata.warning, /Metadata is unavailable/);
  assert.equal(fallback.metadata.book, 'book');
  delete globalThis.__readlistDocumentMocks;
});
