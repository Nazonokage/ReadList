# ReadList

ReadList is an offline-first Expo / React Native app for keeping one personal catalogue of books, novels, manga and light novels, anime, movies, documentaries, TV series, and short films. It combines a visual bookshelf with a compact list, personal notes and ratings, watch/read status, episode tracking, and an in-app PDF/EPUB reader.

**Current source version:** 1.4.0 (Expo SDK 58). This repository version is not, by itself, a published app-store release or a standalone installation package.

## What it does

- **Start with a guided first run.** A fresh library opens a short guide: choose a clearly labelled example library or start empty, then read three steps covering adding a title, finding it again, and resuming progress. The guide is skippable and can be reopened from the header Help button or the Settings sheet.
- **Track a mixed-media library.** Add titles manually or link a PDF/EPUB. Records can include a creator, type/format, multiple categories, status, dates, notes, a cover/spine colour, a 1–5 star rating, and an optional spice rating.
- **Record status and progress.** Reading and watching statuses share a library record. Series have separate current and total episode fields; books can record page counts. Starting/completion dates are captured when applicable and can be edited.
- **Browse and find titles.** Search title, creator, categories and notes; filter by status; switch between book-spine shelves and a list; configure shelves per page; use named presets combining title selection, search, category and status filters.
- **Arrange the shelf.** In Shelves view, press and hold a spine to move that title without opening Arrange mode; a tap still opens details and a swipe still scrolls. **Drag** opens Arrange mode, which adds drag handles and accessible earlier/later arrows and is required for automatic layouts, search, filters and presets. Shelf auto-layouts include status/category groupings and common sort orders.
- **Read locally.** Open a linked PDF or EPUB in the app, resume its saved position, and change theme, text size and PDF view from the reader settings panel. Pinch with two fingers to resize text (or zoom PDF pages) without zooming the whole page. An optional progress indicator (off by default) shows PDF page/total or EPUB section/total with an approximate percentage, and stays visible when the controls are hidden.
- **See insights by media.** Review title counts, completion, ratings and categories, with pages counted from books only and episodes from series only. Titles from the example library are marked as examples and excluded from every total.
- **Keep a local backup.** Settings can download the library as readable JSON (records, presets, reading positions and preferences), check a pasted backup, then merge it or replace the library after a second confirmation. Original files are never included.
- **Exchange a real workbook.** Export one `.xlsx` with ReadList (metadata), Books, Series, Movies and Progress sheets, then re-import it with a preview of counts and skipped rows, merging by ID or replacing the library after a second confirmation. Pages stay with books and episodes with series; the original PDF/EPUB files are never included.

A new library starts empty. The example titles are an explicit first-run choice, are stored with an example marker, are badged on the shelf spines, in the list and in details, and are left out of your insights. Settings can add only the missing example titles without touching your records; "Replace library with example titles" is a separate, confirmed action.

## Run locally

Requirements: Node.js and npm, plus an Android emulator/device for Android testing or Xcode and an iOS simulator/device for local iOS builds. The app uses Expo Go for development preview where its bundled native modules are sufficient; a standalone/offline install is a separate build and release task.

```bash
npm ci
npm start
```

From the Expo development server, choose a target, or use the project scripts:

```bash
npm run web       # Expo web development server
npm run android   # start Expo and open Android
npm run ios       # start Expo and open iOS (requires macOS/Xcode)
```

Useful checks:

```bash
npm test            # Node test suite (data, storage, backup)
npm run lint        # Expo ESLint checks for app code
npm run lint:node   # ESLint for the Node test scripts
npm run typecheck   # TypeScript check (tsc --noEmit)
npm run test:ui     # Playwright browser checks (needs a dist web export + Edge)
npm run test:reader # Playwright reader checks (needs a dist web export + Edge)
```

When changing the reader runtime source, rebuild its generated companion modules with:

```bash
npm run reader:build
```

`npm test` runs the Node tests in `tests/*.test.mjs`. The browser checks in `tests/ui.mjs` and `tests/reader-ui.mjs` expect a web export in `dist` (or `READLIST_DIST` pointing to one) and Microsoft Edge to be available; build one with `npx expo export --platform web --output-dir dist` before running them.

Full install, verification and troubleshooting steps live in [docs/RELEASE.md](docs/RELEASE.md). The manual phone pass is [docs/PHONE-CHECK.md](docs/PHONE-CHECK.md).

## App structure

```text
App.js                         Main library screen and app-level state/actions
src/app/_layout.js             Expo Router stack
src/app/index.js               Library route, re-exporting App.js
src/app/reader.js              Reader route
src/components/                Library, forms, details, presets, shelves, settings, guide and reader frames
src/screens/ReaderScreen.js    File loading, progress persistence, relinking and reader lifecycle
src/database.js                Platform-selected database entry point
src/database.native.js         SQLite storage, native schema migrations, backup and restore
src/database.web.js            Browser localStorage storage, ID repair, backup and restore
src/services/                  Platform-specific local document and workbook file access
src/utils/                     Progress/media classification, ordering, presets, backup, workbook, EPUB and metadata helpers
src/reader/document.js         Self-contained offline reader document generation
src/reader/pdfRuntime.js       Generated bundled PDF.js runtime
src/reader/pdfReflow.js        PDF text reflow implementation
scripts/build-reader-runtime.mjs
                               Builds the generated reader runtime modules
tests/                         Node tests and separate Playwright UI checks
```

The app uses Expo Router, React Native, Expo SQLite, Reanimated and Gesture Handler, Expo document/file APIs, and React Native WebView for the native reader. The browser reader runs in a sandboxed iframe. The PDF.js browser runtime is bundled into the app; reader rendering does not depend on fetching a remote reading service.

## Local data and files

- **Android/iOS database layer:** Expo SQLite database named `readlist_books.db`; the native schema is migrated as fields are added. If SQLite cannot be opened, the code has an in-memory fallback, which does not survive an app restart.
- **Web library:** browser `localStorage` (library key `readlist_books_v2`); presets, shelf settings and reading positions use additional local keys. This data is scoped to the browser profile/origin.
- **Presets, reader positions and preferences:** stored separately from library records. Native storage uses SQLite tables for presets, preferences and reading positions; the browser uses additional local keys. The reading-progress display is off by default, can be changed per title in the reader, and has an app-wide default in Settings.
- **Attachments:** ReadList keeps a reference to the selected original PDF/EPUB; it does not intentionally copy or move the document into its library database. Removing a library record does not delete the original document.
- **Backup:** Settings writes readable JSON containing records, presets, reading positions and preferences. It never contains the original PDF/EPUB files, so links may need relinking on another device. Restoring validates the file first, and replacing the library needs a second confirmation.
- **Workbook:** Settings also exports and imports `.xlsx`. The workbook is generated in the app (no spreadsheet library): ReadList metadata, Books, Series, Movies and Progress sheets. Import validates headers and IDs, reports added/updated/skipped rows, and either merges by ID or replaces the library after a second confirmation. On web the export downloads; on device it is written to the app cache, because sharing out of the app is not implemented yet.
- **Offline/privacy:** there is no app account, cloud sync, remote metadata lookup or analytics service in the implemented library flow. Local storage is **not encrypted** and there is no app lock. Device/browser backup behavior is platform-dependent.

### File access by platform

- **Android:** the app uses the system picker and retains the granted original-file URI. Re-access after process death, reboot or permission changes still needs physical-device validation.
- **Web:** browsers with the File System Access API can retain a file handle locally; the user may need to grant permission again. Other browsers use session-only file access and require relinking after reload/restart.
- **iOS:** retained in-place PDF/EPUB access is not implemented; the current picker reports this limitation. Security-scoped bookmark support is still needed.

The reader currently refuses files above **100 MB**. Metadata parsing is limited to files up to **25 MB**; larger documents can still be linked with manually entered details. Password-protected PDFs are unsupported. PDF Text view is a reflow convenience and may change columns, tables, or reading order; use Original pages when exact layout matters. Scanned-page OCR is not implemented.

## Current data model

Library entries use a shared record shape centred on `book` (display title), `author`, `status`, `subgenres` (comma-separated categories), `type`, page/episode counts, start/end timestamps, `rate`, `spicyLevel`, `color`, `notes`, `sortOrder`, an `isSample` marker for example data, and optional attachment metadata. Series store `episodes` and `currentEpisode`; reading positions are keyed separately by record ID and include format-specific PDF/EPUB location data plus, when the reader changed it, that title's progress-display choice. Insights classify each record as book, series or movie from its `type`, so pages are only counted for books and episodes only for series.

This common record model lets different media share search, presets and details. Spreadsheet interchange and a fuller progress history need a more deliberate schema before they are added; see `TODO.md`.

## Planned work and known gaps

`TODO.md` is the forward-looking checklist; `CHANGELOG.md` describes the current implementation. The main outstanding items are:

- Verify reader progress display, large text, landscape and screen readers on physical devices; browser checks at 390×844, 360×640 and 640×360 are not device coverage.
- Share an exported workbook out of a device, and add a reading/watching event history beyond current positions.
- Improve durable document permissions and relinking tests, especially Android lifecycle cases and iOS bookmarks.
- Finish physical Android/iOS smoke testing and prepare a reproducible standalone app build. A successful web export or Android bundle is not a substitute for device testing.

## Troubleshooting

### Windows: commands fail with a permission error inside the project

A session that runs sandboxed at a low integrity level can only write where its own identity has an explicit allow entry. If every write inside an existing folder fails while the project root works, the entry never propagated to the folders that already existed. Two repairs were needed on this checkout and are recorded in `CHANGELOG.md` (v1.3): grant the signed-in user full control on the workspace root, then grant the sandbox identity modify rights across the existing folders. Reinstalling the checkout elsewhere, or running the tools from a normal terminal, avoids the situation entirely. This is an environment quirk, not an application bug.

## Validation snapshot

At the time this README was written, the following checks were run from the project directory:

- `npm test` — passed, 18 tests, 0 failures.
- `npm run lint`, `npm run lint:node`, `npm run typecheck` and `npx expo-doctor` (20/20) — passed.
- The exported workbook was opened with openpyxl: five sheets, typed numbers, escaped strings and the example marker read correctly.
- `npx expo export --platform web` — completed, and `npm run test:ui` passed against that export, including the first-run guide, settings, backup download/restore, workbook export/re-import and the media-split insights.
- `npm run test:reader` — passed, including reading-position restore after relinking, the reader settings panel, and the optional progress display.

These checks do not establish a release-ready iOS/Android build or substitute for testing on physical devices. `TODO.md` and `CHANGELOG.md` record the remaining verification caveats.
