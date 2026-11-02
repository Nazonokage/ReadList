import * as DocumentPicker from 'expo-document-picker';
import { documentFormat, readDocumentMetadata, METADATA_SIZE_LIMIT } from '../utils/documentMetadata';

const sessionFiles = new Map();
async function handleStore() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('readlist-document-handles', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('handles');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Local file-reference storage is unavailable.'));
  });
}
async function withStore(action) {
  const db = await handleStore();
  try { return await action(db); } finally { db.close(); }
}

export async function pickDocument() {
  let file, handle;
  if (window.showOpenFilePicker) {
    try { [handle] = await window.showOpenFilePicker({ multiple: false, types: [{ description: 'PDF and EPUB books', accept: { 'application/pdf': ['.pdf'], 'application/epub+zip': ['.epub'] } }] }); }
    catch (error) { if (error.name === 'AbortError') return null; throw error; }
    file = await handle.getFile();
  } else {
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'application/epub+zip'], multiple: false, base64: false });
    if (result.canceled) return null;
    file = result.assets[0].file;
  }
  if (!file) throw new Error('The selected file is unavailable.');
  documentFormat(file.name);
  const bytes = file.size <= METADATA_SIZE_LIMIT ? new Uint8Array(await file.arrayBuffer()) : null;
  const metadata = await readDocumentMetadata(bytes, file.name);
  if (!handle) metadata.warning = 'This browser cannot retain file access. The original stays in place; relink it after reopening the app.';
  return { asset: { name: file.name, file, handle }, metadata };
}

export async function persistDocument(asset) {
  const key = `reference-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let uri;
  if (asset.handle) {
    await withStore((db) => new Promise((resolve, reject) => {
      const tx = db.transaction('handles', 'readwrite');
      tx.objectStore('handles').put(asset.handle, key);
      tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
    }));
    uri = `filehandle:${key}`;
  } else { sessionFiles.set(key, asset.file); uri = `sessionfile:${key}`; }
  return { attachmentUri: uri, attachmentName: asset.name, attachmentFormat: documentFormat(asset.name) };
}

export async function removeDocument(uri) {
  // Discard only the failed record's reference, never the original document.
  if (uri?.startsWith('sessionfile:')) sessionFiles.delete(uri.slice('sessionfile:'.length));
}

export async function readDocument(uri) {
  let file;
  try {
    if (uri?.startsWith('filehandle:')) {
      const handle = await withStore((db) => new Promise((resolve, reject) => {
        const request = db.transaction('handles').objectStore('handles').get(uri.slice('filehandle:'.length));
        request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
      }));
      if (!handle || await handle.queryPermission({ mode: 'read' }) !== 'granted') throw new Error('access');
      file = await handle.getFile();
    } else if (uri?.startsWith('sessionfile:')) file = sessionFiles.get(uri.slice('sessionfile:'.length));
    else if (uri?.startsWith('indexeddb:')) {
      // Read old imports for compatibility; new imports store handles only.
      file = await new Promise((resolve, reject) => {
        const request = indexedDB.open('readlist-reading-files', 1);
        request.onsuccess = () => { const db = request.result; if (!db.objectStoreNames.contains('files')) { db.close(); resolve(null); return; } const read = db.transaction('files').objectStore('files').get(uri.slice('indexeddb:'.length)); read.onsuccess = () => { resolve(read.result); db.close(); }; read.onerror = () => { db.close(); reject(read.error); }; }; request.onerror = () => reject(request.error);
      });
    }
    if (!file) throw new Error('missing');
    if (file.size > 100 * 1024 * 1024) throw new Error('This file exceeds the current 100 MB reader limit.');
    return new Uint8Array(await file.arrayBuffer());
  } catch (error) {
    if (error.message?.includes('100 MB')) throw error;
    throw new Error('The original file is missing or access has expired. Relink it to continue from your saved position.');
  }
}
