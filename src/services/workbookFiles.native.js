import { File, Paths } from 'expo-file-system';

const MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export async function pickWorkbook() {
  const picked = await File.pickFileAsync({ mimeTypes: [MIME, 'application/octet-stream'], multipleFiles: false });
  if (picked.canceled) return null;
  const file = picked.result;
  return { name: file.name || 'readlist.xlsx', bytes: await file.bytes() };
}

// Writes into the app cache directory and returns the location. Sharing the file out
// of the app still needs a share sheet, which is a separate TODO item.
export async function saveWorkbook(bytes, filename) {
  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  const handle = file.open('w');
  try { handle.write(bytes); } finally { handle.close(); }
  return file.uri;
}
