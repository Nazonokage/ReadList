import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { chromium } from 'playwright';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { zipSync, strToU8 } from 'fflate';
import { PNG } from 'pngjs';

const directory = resolve(process.env.READLIST_DIST || 'dist');
const server = createServer(async (req, res) => {
  try {
    const path = resolve(directory, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    if (path !== directory && !path.startsWith(directory + sep)) { res.writeHead(403).end(); return; }
    const actual = path === directory || !extname(path) ? resolve(directory, 'index.html') : path;
    res.setHeader('Content-Type', { '.html': 'text/html', '.js': 'text/javascript', '.ttf': 'font/ttf', '.png': 'image/png' }[extname(actual)] || 'application/octet-stream');
    res.end(await readFile(actual));
  } catch { res.writeHead(404).end(); }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
await mkdir('.expo/verification', { recursive: true });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  // Create original test files in the browser's test filesystem, then let the
  // app retain their real FileSystemFileHandles. The app performs no byte copy.
  await page.addInitScript(() => {
    window.showOpenFilePicker = async () => {
      const directory = await navigator.storage.getDirectory();
      const sourceName = sessionStorage.getItem('reader-test-source');
      return [await directory.getFileHandle(sourceName)];
    };
  });
  const errors = [], external = [];
  page.on('pageerror', (error) => { errors.push(error.message); console.error(error.message); });
  page.on('request', (request) => { if (/^https?:/.test(request.url()) && !request.url().startsWith(`http://127.0.0.1:${server.address().port}`)) external.push(request.url()); });
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.getByText('ReadList', { exact: true }).waitFor();
  // A fresh library now opens the guide first. Skip it so the reader checks begin
  // from the same empty library state as before.
  await page.getByText('Welcome to ReadList', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Skip guide', exact: true }).click();
  await page.getByLabel('List view', { exact: true }).click();
  async function importBook(name, bytes, mimeType, title) {
    await page.evaluate(async ({ name, values }) => {
      const directory = await navigator.storage.getDirectory();
      const file = await directory.getFileHandle(name, { create: true });
      const writer = await file.createWritable(); await writer.write(new Uint8Array(values)); await writer.close();
      sessionStorage.setItem('reader-test-source', name);
    }, { name, values: Array.from(bytes) });
    await page.getByLabel('Import PDF or EPUB', { exact: true }).click();
    await page.getByPlaceholder('e.g. Fourth Wing').fill(title);
    await page.getByText('Save', { exact: true }).click();
    await page.getByText('Add New Title', { exact: true }).waitFor({ state: 'hidden' });
  }
  async function toggleControls(reader) {
    await reader.locator('#viewport').evaluate(view => {
      for (let tap = 0; tap < 2; tap++) {
        view.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, pointerType: 'touch', clientX: 30, clientY: 200 }));
        view.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, pointerType: 'touch', clientX: 30, clientY: 200 }));
      }
    });
  }
  async function open(title, missing = false) {
    await page.getByLabel(`Open details for ${title}`, { exact: true }).click();
    await page.getByLabel('Read attached book', { exact: true }).click();
    const reader = page.frameLocator('iframe[title="Offline book reader"]');
    if (missing) return reader;
    await reader.locator('#content > section').first().waitFor();
    await reader.locator('#status:empty').waitFor({ state: 'attached' });
    await toggleControls(reader);
    return reader;
  }
  const pdf = await PDFDocument.create(); const font = await pdf.embedFont(StandardFonts.Helvetica);
  pdf.setTitle('Reading test');
  const imageData = new PNG({ width: 30, height: 20 }); imageData.data.fill(180);
  const embeddedImage = await pdf.embedPng(PNG.sync.write(imageData));
  const firstPage = pdf.addPage([400, 600]); firstPage.drawText('First page: offline PDF rendering', { x: 20, y: 540, size: 18, font });
  firstPage.drawImage(embeddedImage, { x: 30, y: 400, width: 120, height: 80 });
  pdf.addPage([400, 600]).drawText('Second page: resume here', { x: 20, y: 540, size: 18, font });
  const longTitle = "Total Football: A graphic history of the world's most iconic soccer tactics and how the beautiful game changed across generations";
  await importBook('reading.pdf', await pdf.save(), 'application/pdf', longTitle);
  await page.getByLabel(`Open details for ${longTitle}`, { exact: true }).click();
  for (const width of [320, 880]) {
    await page.setViewportSize({ width, height: 844 });
    const title = page.getByText(longTitle, { exact: true }).last();
    await title.scrollIntoViewIfNeeded();
    const box = await title.boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= width + 1, 'Long book title fits the viewport');
  }
  await page.screenshot({ path: '.expo/verification/details-fixed.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel('Read attached book', { exact: true }).click();
  let frame = page.frameLocator('iframe[title="Offline book reader"]');
  await frame.locator('canvas').first().waitFor();
  assert.equal(await frame.locator('.toolbar').isVisible(), false, 'Reader opens without controls');
  await frame.locator('#viewport').evaluate(view => {
    for (let tap = 0; tap < 2; tap++) {
      view.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, pointerType: 'touch', clientX: 30, clientY: 200 }));
      view.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, pointerType: 'touch', clientX: 30, clientY: 200 }));
    }
  });
  assert.equal(await frame.locator('.toolbar').isVisible(), true, 'Touch double tap reveals controls');
  await frame.getByText('Page 1 of 2', { exact: true }).waitFor();
  const darkPixels = await frame.locator('canvas').first().evaluate((canvas) => {
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0; for (let i = 0; i < data.length; i += 4) if (data[i] < 150 && data[i + 3]) count++; return count;
  });
  assert.ok(darkPixels > 50, 'PDF text was actually rendered');
  // Theme, text size and PDF view now live in the reader settings panel.
  await frame.getByRole('button', { name: 'Settings', exact: true }).click();
  assert.equal(await frame.locator('#settings-panel').isVisible(), true, 'Settings opens the reader settings panel');
  await frame.locator('#text-mode').click();
  await frame.locator('.pdf-prose').first().waitFor();
  await frame.locator('#status:empty').waitFor({ state: 'attached' });
  await frame.getByText('First page: offline PDF rendering', { exact: true }).waitFor();
  const illustration = frame.getByAltText('PDF illustration').first();
  await illustration.evaluate(image => image.decode());
  const originalImage = await illustration.boundingBox();
  await frame.getByRole('button', { name: 'Larger text or zoom in' }).click();
  assert.equal(await frame.locator('#content').evaluate(content => getComputedStyle(content).fontSize), '22px');
  const resizedImage = await illustration.boundingBox();
  assert.ok(Math.abs(originalImage.width-resizedImage.width)<1 && Math.abs(originalImage.height-resizedImage.height)<1, 'Text resizing keeps PDF illustration dimensions');
  await frame.locator('body').evaluate(body => body.dataset.readerInstance = 'keep-document');
  await frame.getByRole('button', { name: 'Hide controls', exact: true }).click();
  await page.waitForTimeout(200);
  assert.equal(await frame.locator('body').getAttribute('data-reader-instance'), 'keep-document', 'Toggling controls keeps the loaded document mounted');
  assert.equal(await frame.getByAltText('PDF illustration').count(), 1);
  await page.screenshot({ path: '.expo/verification/pdf-text-view.png', fullPage: true });
  await toggleControls(frame);
  await frame.getByRole('button', { name: 'Settings', exact: true }).click();
  await frame.locator('#text-mode').click();
  await frame.locator('canvas').first().waitFor();
  await frame.getByLabel('PDF page', { exact: true }).fill('1');
  await frame.getByLabel('PDF page', { exact: true }).dispatchEvent('change');

  await context.setOffline(true);
  await frame.getByRole('button', { name: 'Next', exact: true }).click();
  await frame.getByText('Page 2 of 2', { exact: true }).waitFor();
  await frame.getByRole('button', { name: 'Invert pages', exact: true }).click();
  await frame.getByRole('button', { name: 'Hide controls', exact: true }).click();
  await frame.locator('#viewport').evaluate(view => { view.scrollTop = 0; });
  await page.waitForTimeout(200);
  await frame.locator('#viewport').evaluate(view => { view.scrollTop = view.scrollHeight; });
  await page.waitForTimeout(250);
  assert.equal(await frame.locator('.toolbar').isVisible(), false, 'Scrolling does not reveal HUD');
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(350);
  assert.equal(await frame.locator('#viewport').evaluate(view => view.scrollWidth <= view.clientWidth + 1), true, 'PDF fits landscape width');
  await page.screenshot({ path: '.expo/verification/pdf-landscape.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(350);
  await toggleControls(frame);
  await frame.getByText('Page 2 of 2', { exact: true }).waitFor();
  await page.screenshot({ path: '.expo/verification/pdf-reader.png', fullPage: true });
  const pdfScroll = await frame.locator('#viewport').evaluate(view => view.scrollTop);
  await frame.getByRole('button', { name: 'Close reader', exact: true }).click();
  frame = await open(longTitle);
  await frame.getByText('Page 2 of 2', { exact: true }).waitFor();
  assert.equal(await frame.locator('body').evaluate((body) => body.classList.contains('inverted')), true);
  assert.ok(Math.abs(await frame.locator('#viewport').evaluate(view => view.scrollTop) - pdfScroll) < 3, 'PDF restores the precise scroll offset between pages');
  await frame.getByRole('button', { name: 'Close reader', exact: true }).click();
  await context.setOffline(false);

  const scanned = await PDFDocument.create();
  const scanImage = await scanned.embedPng(PNG.sync.write(imageData));
  scanned.addPage([400, 600]).drawImage(scanImage, { x: 0, y: 0, width: 400, height: 600 });
  await importBook('scanned.pdf', await scanned.save(), 'application/pdf', 'Scanned fallback test');
  frame = await open('Scanned fallback test');
  await frame.getByRole('button', { name: 'Settings', exact: true }).click();
  await frame.locator('#text-mode').click();
  await frame.getByText('No selectable text on this page. Original page shown.', { exact: true }).waitFor();
  assert.equal(await frame.locator('canvas').count(), 1);
  await frame.getByRole('button', { name: 'Close reader', exact: true }).click();

  const png = new PNG({ width: 2, height: 2 }); png.data.fill(180);
  const epub = zipSync({
    mimetype: [strToU8('application/epub+zip'), { level: 0 }],
    'META-INF/container.xml': strToU8('<container><rootfiles><rootfile full-path="OPS/book.opf"/></rootfiles></container>'),
    'OPS/book.opf': strToU8('<package xmlns:dc="http://purl.org/dc/elements/1.1/"><metadata><dc:title>Offline EPUB</dc:title><dc:creator>Author</dc:creator></metadata><manifest><item id="one" href="one.xhtml" media-type="application/xhtml+xml"/><item id="two" href="two.xhtml" media-type="application/xhtml+xml"/><item id="picture" href="image.png" media-type="image/png"/></manifest><spine><itemref idref="one"/><itemref idref="two"/></spine></package>'),
    'OPS/one.xhtml': strToU8('<html><head><title>First chapter</title></head><body><h1>First chapter</h1><p>This book stays offline.</p><img src="image.png" alt="Local illustration"/><script>parent.postMessage({attack:true},"*")</script><img src="https://example.com/tracker.png"/></body></html>'),
    'OPS/two.xhtml': strToU8('<html><head><title>Second chapter</title></head><body><h1>Second chapter</h1>' + '<p>Read this story at your own pace. Your position is saved on this device.</p>'.repeat(80) + '</body></html>'),
    'OPS/image.png': PNG.sync.write(png),
  });
  await importBook('reading.epub', epub, 'application/epub+zip', 'EPUB reading test');
  frame = await open('EPUB reading test');
  await frame.getByRole('heading', { name: 'First chapter' }).waitFor();
  assert.equal(await frame.locator('#content script').count(), 0);
  await frame.getByAltText('Local illustration').evaluate((image) => image.decode());
  await context.setOffline(true);
  await frame.getByRole('button', { name: 'Next', exact: true }).click();
  await frame.getByRole('heading', { name: 'Second chapter' }).waitFor();
  await frame.getByRole('button', { name: 'Settings', exact: true }).click();
  await frame.getByRole('button', { name: 'Change reader theme' }).click();
  const startingFont = await frame.locator('#content').evaluate(content => parseFloat(getComputedStyle(content).fontSize));
  await frame.getByRole('button', { name: 'Larger text or zoom in' }).click();
  assert.equal(await frame.locator('#content').evaluate(content => parseFloat(getComputedStyle(content).fontSize)), startingFont + 2);
  await frame.getByRole('button', { name: 'Smaller text or zoom out' }).click();
  assert.equal(await frame.locator('#content').evaluate(content => parseFloat(getComputedStyle(content).fontSize)), startingFont);
  await frame.getByRole('button', { name: 'Larger text or zoom in' }).click();
  await frame.locator('#viewport').evaluate((view) => { view.scrollTop = (view.scrollHeight - view.clientHeight) / 2; });
  await frame.getByRole('button', { name: 'Close reader', exact: true }).click();
  frame = await open('EPUB reading test');
  await frame.getByRole('heading', { name: 'Second chapter' }).waitFor();
  await frame.getByRole('button', { name: 'Close reader', exact: true }).click();
  await page.getByText('ReadList', { exact: true }).waitFor();
  await page.evaluate(async () => { const directory = await navigator.storage.getDirectory(); await directory.removeEntry('reading.epub'); });
  frame = await open('EPUB reading test', true);
  await page.getByLabel('Relink original file', { exact: true }).waitFor();
  await page.evaluate(async (values) => {
    const directory = await navigator.storage.getDirectory();
    const handle = await directory.getFileHandle('renamed-reading.epub', { create: true });
    const writer = await handle.createWritable(); await writer.write(new Uint8Array(values)); await writer.close();
    sessionStorage.setItem('reader-test-source', 'renamed-reading.epub');
  }, Array.from(epub));
  await page.getByLabel('Relink original file', { exact: true }).click();
  frame = page.frameLocator('iframe[title="Offline book reader"]');
  await frame.getByRole('heading', { name: 'Second chapter' }).waitFor();
  await frame.locator('#status:empty').waitFor({ state: 'attached' });
  await toggleControls(frame);
  assert.equal(await frame.locator('body').evaluate((body) => body.classList.contains('paper')), true);
  assert.equal(await frame.locator('body').evaluate((body) => body.classList.contains('paper')), true);
  // The iframe performs a debounced position restore when its viewport settles.
  await page.waitForTimeout(250);
  const geometry = await frame.locator('#viewport').evaluate(view => ({ top:view.scrollTop, height:view.scrollHeight, client:view.clientHeight, content:view.querySelector('#content').offsetHeight, sections:Array.from(view.querySelectorAll('section')).map(s=>({top:s.offsetTop,height:s.offsetHeight})), font:getComputedStyle(view.querySelector('#content')).fontSize }));
  const restoredScroll = geometry.top / (geometry.height - geometry.client);
  if (restoredScroll <= .4 || restoredScroll >= .6) { console.log('Position geometry', geometry); await page.screenshot({path:'.expo/verification/reader-failure.png'}); }
  assert.ok(restoredScroll > .4 && restoredScroll < .6, 'EPUB resumes at its saved chapter and scroll position: '+restoredScroll);
  await frame.getByRole('button', { name: 'Hide controls', exact: true }).click();
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(300);
  assert.equal(await frame.locator('#viewport').evaluate(view => view.scrollWidth <= view.clientWidth + 1), true, 'EPUB reflows to landscape width');
  await page.screenshot({ path: '.expo/verification/epub-landscape.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: '.expo/verification/epub-reader.png', fullPage: true });
  await toggleControls(frame);
  await frame.getByRole('button', { name: 'Close reader', exact: true }).click();
  await context.setOffline(false);
  await page.getByText('ReadList', { exact: true }).waitFor();
  await page.reload();
  await page.getByLabel('List view', { exact: true }).click();
  frame = await open('EPUB reading test');
  await frame.getByRole('heading', { name: 'Second chapter' }).waitFor();
  assert.equal(await frame.locator('#content').evaluate(content => getComputedStyle(content).fontSize), '22px', 'EPUB font preference survives reopening');

  // Two-finger pinch resizes the text instead of zooming the whole page.
  const pinch = async (startGap, endGap) => frame.locator('#viewport').evaluate((view, gaps) => {
    const centerX = view.clientWidth / 2;
    const centerY = 220;
    const fire = (type, id, x, y) => view.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true }));
    fire('pointerdown', 11, centerX - gaps.startGap / 2, centerY);
    fire('pointerdown', 12, centerX + gaps.startGap / 2, centerY);
    fire('pointermove', 11, centerX - gaps.endGap / 2, centerY);
    fire('pointermove', 12, centerX + gaps.endGap / 2, centerY);
    fire('pointerup', 11, centerX - gaps.endGap / 2, centerY);
    fire('pointerup', 12, centerX + gaps.endGap / 2, centerY);
  }, { startGap, endGap });
  const fontBeforePinch = await frame.locator('#content').evaluate((content) => parseFloat(getComputedStyle(content).fontSize));
  await pinch(100, 160);
  await page.waitForTimeout(200);
  const fontWider = await frame.locator('#content').evaluate((content) => parseFloat(getComputedStyle(content).fontSize));
  assert.ok(fontWider > fontBeforePinch, `pinch out enlarges the text (${fontBeforePinch} -> ${fontWider})`);
  await pinch(160, 100);
  await page.waitForTimeout(200);
  const fontNarrower = await frame.locator('#content').evaluate((content) => parseFloat(getComputedStyle(content).fontSize));
  assert.ok(fontNarrower < fontWider, `pinch in shrinks the text (${fontWider} -> ${fontNarrower})`);
  assert.equal(fontNarrower, fontBeforePinch, 'pinching back restores the original size');

  // Reading progress: off by default, enabled per title from reader settings, and it
  // stays visible with the controls hidden. It must not change the saved position.
  const epubPosition = () => page.evaluate(() => {
    const key = Object.keys(localStorage).find((name) => name.startsWith('readlist_position_') && (localStorage.getItem(name) || '').includes('"chapterId":"OPS/two.xhtml"'));
    return key ? JSON.parse(localStorage.getItem(key)) : null;
  });
  assert.equal(await frame.locator('#reading-progress').isVisible(), false, 'reading progress is hidden by default');
  const positionBeforeProgress = await epubPosition();
  await frame.getByRole('button', { name: 'Settings', exact: true }).click();
  await frame.getByRole('checkbox', { name: 'Show reading progress' }).check();
  await frame.getByText('Use app default', { exact: true }).waitFor();
  await frame.getByRole('button', { name: 'Close reader settings', exact: true }).click();
  await frame.getByRole('button', { name: 'Hide controls', exact: true }).click();
  const progressText = await frame.locator('#reading-progress').textContent();
  assert.match(progressText, /^Section \d+ of 2 · ~\d+%$/, 'progress names the section and an estimated percentage');
  assert.equal(await frame.locator('#reading-progress').isVisible(), true, 'progress stays visible with the controls hidden');
  await page.waitForTimeout(300);
  const positionAfterProgress = await epubPosition();
  assert.equal(positionAfterProgress.scroll, positionBeforeProgress.scroll, 'turning on progress does not reset the reading position');
  await toggleControls(frame);
  await frame.getByRole('button', { name: 'Close reader', exact: true }).click();
  await page.getByText('ReadList', { exact: true }).waitFor();
  frame = await open('EPUB reading test');
  await frame.getByRole('heading', { name: 'Second chapter' }).waitFor();
  assert.equal(await frame.locator('#reading-progress').isVisible(), true, 'the per-title progress choice survives reopening');
  await frame.getByRole('button', { name: 'Close reader', exact: true }).click();
  await page.getByText('ReadList', { exact: true }).waitFor();
  frame = await open(longTitle);
  assert.equal(await frame.locator('#reading-progress').isVisible(), false, 'a title without its own choice keeps the app default of off');
  await frame.getByRole('button', { name: 'Close reader', exact: true }).click();
  await page.getByText('ReadList', { exact: true }).waitFor();

  // Small phone and landscape: the reader settings panel and the progress pill must
  // stay usable, not clipped, and not cover the footer controls.
  frame = await open('EPUB reading test');
  await frame.getByRole('heading', { name: 'Second chapter' }).waitFor();
  for (const [width, height] of [[360, 640], [640, 360]]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(350);
    if (!(await frame.locator('.toolbar').isVisible())) await toggleControls(frame);
    await frame.getByRole('button', { name: 'Settings', exact: true }).click();
    const panel = await frame.locator('#settings-panel').boundingBox();
    assert.ok(panel && panel.y >= 0 && panel.y + panel.height <= height, `reader settings fit inside ${width}x${height}`);
    assert.equal(await frame.getByRole('checkbox', { name: 'Show reading progress' }).isVisible(), true, `the progress switch is reachable at ${width}x${height}`);
    await frame.getByRole('button', { name: 'Close reader settings', exact: true }).click();
    const pill = await frame.locator('#reading-progress').boundingBox();
    const nextButton = await frame.getByRole('button', { name: 'Next', exact: true }).boundingBox();
    assert.ok(pill && nextButton && pill.y + pill.height <= nextButton.y, `progress pill clears the footer at ${width}x${height}`);
    assert.match(await frame.locator('#reading-progress').textContent(), /^Section \d+ of 2 · ~\d+%$/, `progress text survives ${width}x${height}`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(250);
  if (!(await frame.locator('.toolbar').isVisible())) await toggleControls(frame);
  await frame.getByRole('button', { name: 'Close reader', exact: true }).click();
  await page.getByText('ReadList', { exact: true }).waitFor();

  assert.deepEqual(external, []);
  assert.deepEqual(errors, []);
  console.log('Reader UI passed: PDF rendering, offline navigation, long-title layout, EPUB images/sanitization, reading-position restore, relinking originals without losing progress, reader settings and optional progress on small and landscape viewports, and two-finger text resizing.');
} finally { await browser.close(); await new Promise((done) => server.close(done)); }
