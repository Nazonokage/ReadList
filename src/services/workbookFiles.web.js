const MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export async function saveWorkbook(bytes, filename) {
  const blob = new Blob([bytes], { type: MIME });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return filename;
}

// The browser has no cancel event for a programmatic file input in every engine, so
// the promise also settles when the window regains focus without a selection.
export async function pickWorkbook() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = `.xlsx,${MIME}`;
    input.style.display = 'none';
    let settled = false;
    const finish = (value) => { if (settled) return; settled = true; cleanup(); resolve(value); };
    const fail = (error) => { if (settled) return; settled = true; cleanup(); reject(error); };
    const onFocus = () => { setTimeout(() => finish(null), 400); };
    function cleanup() {
      window.removeEventListener('focus', onFocus);
      input.remove();
    }
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) { finish(null); return; }
      try { finish({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) }); }
      catch (error) { fail(error); }
    };
    input.oncancel = () => finish(null);
    window.addEventListener('focus', onFocus);
    document.body.appendChild(input);
    input.click();
  });
}
