import { File } from 'expo-file-system';
import { Platform } from 'react-native';
import { documentFormat, readDocumentMetadata, METADATA_SIZE_LIMIT } from '../utils/documentMetadata';

export async function pickDocument() {
  if (Platform.OS === 'ios') throw new Error('In-place file links are currently supported on Android. iOS needs development-build support for retained file access.');
  // Android's system picker retains access to the selected original URI.
  const picked = await File.pickFileAsync({ mimeTypes: ['application/pdf', 'application/epub+zip', 'application/octet-stream'], multipleFiles: false });
  if (picked.canceled) return null;
  const file = picked.result;
  let name = decodeURIComponent(file.name || '').split('/').pop();
  let format;
  try { format = documentFormat(name); }
  catch {
    if (file.type === 'application/pdf') format = 'PDF';
    else if (file.type === 'application/epub+zip') format = 'EPUB';
    else {
      const handle = file.open('r');
      try {
        const signature = await handle.readBytes(8);
        if (signature[0] === 37 && signature[1] === 80 && signature[2] === 68 && signature[3] === 70) format = 'PDF';
        else if (signature[0] === 80 && signature[1] === 75) format = 'EPUB';
        else throw new Error('Choose a PDF or EPUB document.');
      } finally { handle.close(); }
    }
    name = `Selected document.${format.toLowerCase()}`;
  }
  let bytes = null, warning = '';
  try { if (file.size <= METADATA_SIZE_LIMIT) bytes = await file.bytes(); }
  catch { warning = 'The original file is linked. Metadata is unavailable; enter the details below.'; }
  const metadata = await readDocumentMetadata(bytes, name);
  if (warning) metadata.warning = warning;
  return { asset: { uri: file.uri, name, size: file.size, mimeType: file.type }, metadata };
}

export async function persistDocument(asset) {
  return { attachmentUri: asset.uri, attachmentName: asset.name, attachmentFormat: documentFormat(asset.name) };
}

// Failed record saves must never delete or modify the user's original document.
export async function removeDocument() {}

export async function readDocument(uri) {
  const file = new File(uri);
  try {
    if (!file.exists) throw new Error('missing');
    if (file.size > 100 * 1024 * 1024) throw new Error('This file exceeds the current 100 MB reader limit.');
    return await file.bytes();
  } catch (error) {
    if (error.message?.includes('100 MB')) throw error;
    throw new Error('The original file is missing or access has expired. Relink it to continue from your saved position.');
  }
}
