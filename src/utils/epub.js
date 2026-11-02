import { unzipSync, strFromU8, strToU8 } from 'fflate';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

const allowed = new Set('body div section article p h1 h2 h3 h4 h5 h6 span b strong i em u s sub sup blockquote pre code ul ol li dl dt dd table thead tbody tfoot tr td th caption img figure figcaption br hr a ruby rt rp'.split(' '));
const blocked = new Set(['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'video', 'audio', 'link', 'meta', 'svg']);
const serializer = new XMLSerializer();

export function toBase64(bytes) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] || 0) << 8) | (bytes[i + 2] || 0);
    result += alphabet[n >>> 18 & 63] + alphabet[n >>> 12 & 63] + (i + 1 < bytes.length ? alphabet[n >>> 6 & 63] : '=') + (i + 2 < bytes.length ? alphabet[n & 63] : '=');
  }
  return result;
}

function parse(text) {
  if (/<!ENTITY/i.test(text)) throw new Error('Unsupported EPUB entity declaration.');
  // Many normal EPUB XHTML documents include a harmless external DTD. Do not load it.
  return new DOMParser().parseFromString(text.replace(/<!DOCTYPE[^>]*>/gi, ''), 'application/xml');
}

function archivePath(base, relative) {
  const path = [];
  for (const part of (base.slice(0, base.lastIndexOf('/') + 1) + relative).split('/')) {
    if (part === '..') path.pop(); else if (part && part !== '.') path.push(part);
  }
  return decodeURIComponent(path.join('/').split('#')[0]);
}

export function parseEpub(bytes) {
  let total = 0, entries = 0;
  const files = unzipSync(bytes, { filter: (entry) => {
    total += entry.originalSize;
    if (++entries > 10000 || total > 150 * 1024 * 1024 || entry.originalSize > 30 * 1024 * 1024) throw new Error('This EPUB exceeds the reader archive limit.');
    return !entry.name.endsWith('/');
  } });
  const container = files['META-INF/container.xml'];
  if (!container) throw new Error('This is not a supported EPUB archive.');
  const packagePath = parse(strFromU8(container)).getElementsByTagNameNS('*', 'rootfile')[0]?.getAttribute('full-path');
  if (!packagePath || !files[packagePath]) throw new Error('The EPUB package is missing.');
  const doc = parse(strFromU8(files[packagePath]));
  const manifest = new Map(Array.from(doc.getElementsByTagNameNS('*', 'item')).map((item) => [item.getAttribute('id'), { path: archivePath(packagePath, item.getAttribute('href') || ''), type: item.getAttribute('media-type') }]));
  const resources = new Map(Array.from(manifest.values()).map((item) => [item.path, item]));
  function sanitize(node, chapterPath) {
    for (const child of Array.from(node.childNodes || [])) {
      if (child.nodeType !== 1) continue;
      const tag = child.localName?.toLowerCase();
      if (tag === 'svg') {
        const scrub = (svg) => {
          for (const element of Array.from(svg.childNodes || [])) {
            if (element.nodeType !== 1) continue;
            if (['script', 'foreignobject', 'animate', 'animatetransform', 'set', 'style'].includes(element.localName.toLowerCase())) { svg.removeChild(element); continue; }
            scrub(element);
          }
          for (const attr of Array.from(svg.attributes || [])) {
            if (/^on/i.test(attr.name) || /url\(\s*[^#]/i.test(attr.value)) svg.removeAttribute(attr.name);
            else if (/href$/.test(attr.name) && !attr.value.startsWith('#')) {
              const path = archivePath(chapterPath, attr.value), resource = resources.get(path);
              if (resource && /^image\/(png|jpeg|gif|webp)$/.test(resource.type) && files[path]) svg.setAttribute(attr.name, `data:${resource.type};base64,${toBase64(files[path])}`);
              else svg.removeAttribute(attr.name);
            }
          }
        };
        scrub(child);
        const image = child.ownerDocument.createElement('img');
        image.setAttribute('alt', 'Illustration');
        image.setAttribute('src', `data:image/svg+xml;base64,${toBase64(strToU8(serializer.serializeToString(child)))}`);
        node.replaceChild(image, child);
        continue;
      }
      if (blocked.has(tag)) { node.removeChild(child); continue; }
      sanitize(child, chapterPath);
      for (const attr of Array.from(child.attributes || [])) {
        if (!['id', 'colspan', 'rowspan', 'alt'].includes(attr.name)) child.removeAttribute(attr.name);
      }
      if (tag === 'img') {
        // Resolve the original attribute from a separately preserved value below.
        const source = child.__source;
        const path = source ? archivePath(chapterPath, source) : '';
        const resource = resources.get(path);
        if (resource && /^image\/(png|jpeg|gif|webp)$/.test(resource.type) && files[path]) child.setAttribute('src', `data:${resource.type};base64,${toBase64(files[path])}`);
        else { node.removeChild(child); continue; }
      }
      if (!allowed.has(tag)) {
        while (child.firstChild) node.insertBefore(child.firstChild, child);
        node.removeChild(child);
      }
    }
  }
  const chapters = [];
  for (const ref of Array.from(doc.getElementsByTagNameNS('*', 'itemref'))) {
    if (ref.getAttribute('linear') === 'no') continue;
    const item = manifest.get(ref.getAttribute('idref'));
    if (!item || !files[item.path] || !/html/.test(item.type)) continue;
    const chapter = parse(strFromU8(files[item.path]));
    const body = chapter.getElementsByTagName('body')[0] || chapter.documentElement;
    for (const image of Array.from(body.getElementsByTagName('img'))) image.__source = image.getAttribute('src');
    const title = chapter.getElementsByTagName('title')[0]?.textContent?.trim() || body.getElementsByTagName('h1')[0]?.textContent?.trim() || `Section ${chapters.length + 1}`;
    sanitize(body, item.path);
    chapters.push({ id: item.path, title, html: Array.from(body.childNodes).map((node) => serializer.serializeToString(node)).join('') });
  }
  if (!chapters.length) throw new Error('No readable chapters were found. DRM-protected EPUBs are not supported.');
  return chapters;
}
