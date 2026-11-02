# Changelog

Changes to ReadList are recorded here. Planned work lives in [TODO.md](TODO.md); the design proposal and implementation notes live in [DESIGN.md](DESIGN.md).

## v1.4 — 2026-11-02

Git tag: `v1.4`. Application version: `1.4.0`. This source release does not imply an app-store release or a distributed standalone build.

### Reader

- Fixed lost reading positions after relinking a moved document. The reader restored before the frame had a layout, then a scroll event measured the un-restored top and saved over the good position. A restore now stays pending until the document is measurable, and scroll measurements are ignored until then. A plain reopen and a relink both resume correctly.
- Added a reader settings panel reachable from the controls: theme, text size, and PDF Text view / Original pages / Fit width / Invert pages now live there instead of the toolbar.
- Added **Show reading progress**, off by default. When on it shows `Page 3 of 12` for PDFs and `Section 2 of 2 · ~71%` for EPUBs, with the estimate labelled as section-based rather than a page count. It sits outside the toolbar and footer, so it stays visible with the controls hidden.
- The progress choice made while reading is stored with that title; the app default in Settings applies to titles that were never changed, and the reader offers "Use app default" to clear a per-title choice. Turning progress on or off never changes the saved position.
- Added two-finger pinch to resize: it changes the text size for EPUBs and PDF Text view, and zooms PDF Original pages when the fingers lift, instead of zooming the whole page. The reading position is kept while pinching, and one-finger scrolling stays native.

### Shelves

- Added press and hold on a shelf spine to move that title without opening Arrange mode. A short tap still opens details, an ordinary swipe still scrolls, and a cancelled or short hold reorders nothing.
- The press-and-hold move is offered only for the manual layout, so an automatic sort, active search, filter or preset can never be silently overwritten. Arrange mode keeps its accessible earlier/later controls as the non-gesture alternative.
- Not implemented yet: edge autoscroll, an explicit drop-target highlight, and moving across shelf pages. Those stay in TODO.md, together with physical-device testing of the long press.

### Spreadsheet exchange

- Replaced the legacy pasted-CSV panel with a real `.xlsx` workbook exchange. The workbook has ReadList (metadata), Books, Series (anime and TV), Movies and Progress sheets, and is built and read without a spreadsheet dependency: fflate writes the zip and @xmldom/xmldom reads it, both already used by the EPUB path.
- Export includes stable IDs, categories, status, ratings, dates, page and episode counts, current episode, order, relinking hints and the example marker. It never embeds or moves the original PDF/EPUB files.
- Import previews the file first: title counts per sheet, reading positions, how many records would be added versus updated, and any skipped rows with reasons. Merging is by ID; replacing requires a second confirmation and copies the previous library into the backup box before writing.
- Validation rejects unreadable archives, missing sheets, missing id/title columns and duplicate IDs, and accepts common header aliases so a hand-edited sheet still imports. Records and reading positions commit together; a rejected import leaves the library untouched.
- Removed `CsvManagerModal` and the database CSV export helper.
- Verified the workbook with a strict OOXML reader (openpyxl): sheets, headers, numeric cells, escaped strings and the example marker all read correctly. That check found the package was missing a default cell style, which is now written, so spreadsheet applications no longer have to invent one.

### Settings and local data

- Added a Settings sheet (header gear): reading default, shelves per page, quick guide replay, spreadsheet tools, and local data controls. The header no longer carries a separate spreadsheet icon.
- Added JSON backup and restore. A backup contains records, presets, reading positions and preferences, never the original PDF/EPUB files; it is downloadable on web and copyable elsewhere. Restoring validates the file first, reports what it contains, supports merge or replace, and replace requires a second confirmation.
- Added "Add example titles", which appends only the examples that are missing and leaves existing records alone. The destructive replace-with-examples action stays behind a confirmation.

### Insights

- Split insights by media: pages are counted from books only, episodes from series only, and a by-media section reports book, series and movie counts. Example titles remain excluded from every total.

### Tooling

- Added a Node-aware ESLint configuration for `tests/**` and `scripts/**`, plus `npm run lint:node`. Added `npm run test:ui` and `npm run test:reader` so the browser checks are reachable from npm scripts instead of being run by hand.

### Validation and limits

- `npm test` passes 18 of 18 tests, including new coverage for media classification, backup validation, a native backup round trip with reading positions, non-destructive example loading, and workbook round trips, aliased headers, duplicate IDs, missing titles and malformed archives.
- `npx tsc --noEmit`, `npx expo lint` and `npm run lint:node` pass. `npx expo export --platform web` completes. `npx expo-doctor` passes 20 of 20 checks, and a reader-runtime rebuild leaves the generated modules byte-identical.
- `tests/ui.mjs` passes, now also covering the Settings sheet, the persisted reading default, non-destructive example loading, a real backup download and restore, a real workbook export and re-import, the media-split insights, a plain tap on a shelf spine, and a press-and-hold shelf move that does not enter Arrange mode.
- `tests/reader-ui.mjs` passes, now also covering the reader settings panel, progress hidden by default, progress enabled per title with the controls hidden, the choice surviving a reopen, the app default staying off for another title, the position being unchanged by the toggle, two-finger text resizing, and the settings panel plus progress pill at 360×640 and 640×360.
- Still outstanding: sharing an exported workbook out of a device (it lands in the app cache), a reading/watching event history beyond current positions, edge autoscroll and drop-target highlighting for shelf dragging, and every physical-device check. Browser coverage is not device coverage.

## v1.3 — 2026-11-02

Git tag: `v1.3`. Application version: `1.3.0`. This source release does not imply an app-store release or a distributed standalone build.

### First use and example data

- Connected the first-run guide to the library screen. A fresh library opens a welcome step that offers a clearly labelled example library or an empty one, followed by three short steps: add a title, find it again, and pick up where you left off. The guide is skippable, closes on Android back, and records that it was seen.
- Made the guide replayable after first run from a new Help button in the header and from the empty-library state.
- Marked example titles in storage (`isSample`), on the shelf spines, in the list and in details, and after a CSV reset. Insights now exclude example titles from every personal total and say so, instead of mixing seed data into the user's statistics.
- Reworded the shared surfaces to talk about a "title" or "library" rather than a "book": empty states, list/card headers, delete prompt, save alert, shelf arrangement controls, CSV reset and import feedback, reader loading and error text, and the untitled-record fallback. Media-specific wording remains where the action concerns that medium, and the legacy CSV column header stays "Book" because it is a field name in the old spreadsheet format.
- Made the empty library state distinguish no titles, no search results and no filter matches, each with the action that resolves it.

### Fixes

- Fixed the `react-hooks/set-state-in-effect` lint error in the guide: the modal is now remounted with a new key when it opens, so its step and library choice come from props instead of an effect that reset state.
- Fixed the failing native library test. Two tests imported identical base64 data-URL modules, so the second test received the first test's cached module and its already-closed database. Each test now imports a unique module instance.
- Added the `isSample` column as a migration on existing databases and carried the flag through insert, update and reset paths.

### Validation and limits

- `npm test` passes 13 of 13 tests, including new assertions that seeded titles are marked as examples and that a user-added title is not.
- `npx tsc --noEmit` and `npx expo lint` pass. `npx expo export --platform web` completes.
- `tests/ui.mjs` passes end to end, including the new welcome step, the example-library choice, the three guide steps, finishing the guide, replaying it from the header Help button, and reload persistence of that choice.
- `tests/reader-ui.mjs` needs to skip the guide on a fresh library and now does. It still fails one position assertion: after relinking a moved EPUB, the reader reopens on the saved section at scroll 0 instead of the saved scroll offset, and overwrites the stored position with that reset value. A plain reopen restores the position correctly, and the stored position is correct until the relink session saves over it. This is recorded as outstanding work in TODO.md and is not caused by the first-run changes.
- The guide was checked in desktop Chromium at 390×844 only. Physical-device, large-text, landscape and screen-reader checks remain, along with the rest of the outstanding items in TODO.md.

## v1.2 — 2026-11-02

Git tag: `v1.2`. Application version: `1.2.0`. This source release does not imply an app-store release or a distributed standalone build.

### Library and tracking

- Added searchable entry fields for creators, formats and categories, including multiple custom categories per title.
- Made the author field directly editable with normal keyboard Backspace/Delete; an author may be left blank.
- Added movies, documentaries, TV series and short films alongside books and anime, with reading/watching statuses.
- Added total episodes and current episode for series, with the current episode visible in list, shelf and detail views.
- Defaulted new records to the current local start timestamp. End dates are optional and display Ongoing until recorded; marking a title Completed fills an empty finish timestamp.
- Made spice ratings optional and removable. Unrated titles are excluded from the spice average.
- Added named presets combining selected titles, their order, search, categories and statuses.

### Browsing and interaction

- Made Shelves the default view and retained a complete row-based List view.
- Added configurable shelf counts from 1 to 20 per page and shelf pagination.
- Reworked the existing Arrange-mode drag behavior to use measured drop targets and preserve record IDs when saving order.
- Added reorder rollback on persistence failure and repaired missing/duplicate IDs in legacy browser records.
- Fixed long-title wrapping in details and added tap-outside dismissal to the add/edit form.

### Files and reader

- Added PDF/EPUB file selection with editable local metadata, including PDF page counts where readable. EPUBs do not have a fixed page count.
- Linked original files without moving or copying them into library storage. Saved reading positions are stored separately from file content.
- Added an offline in-app PDF/EPUB reader with continuous vertical scrolling, screen-width fitting, landscape support, dark/paper themes and saved reading positions.
- Hid reader controls by default; double tap reveals them. Keyboard users can press H.
- Added EPUB font sizing from 14 to 40 px, retaining the 20 px default and saving the preference per title.
- Added optional PDF Text view for wrapping and resizing selectable text. Raster illustrations retain their size independently of the text, capped to screen width; Original pages remains available for exact layout.
- Kept scanned PDF pages as original images when selectable text is unavailable, and provided original-page previews for vector artwork.
- Added relinking for missing files while retaining reading progress.
- Kept loaded reader documents stable when controls change to avoid losing content or position.

### Storage and maintenance

- Added migration-safe local fields for attachments and episode tracking, plus local presets, shelf preferences and reading positions.
- Migrated legacy series totals from the pages field to episodes.
- Added Expo Router navigation, lint/typecheck commands, data tests and browser interaction checks.
- Repaired a truncated Windows Lightning CSS dependency in the local development installation and verified successful web and Android bundle downloads. This was an environment repair, not a new application feature.

### Validation and limits

- Lint and typecheck passed during development. Ten data/service tests and browser checks cover metadata, migrations, reorder persistence/rollback, presets, author editing, categories, episodes, reader fonts, image sizing, offline reading, position recovery and relinking.
- Web exports and Android bundling passed. These checks do not replace verification on physical devices.
- XLSX exchange, reader settings with optional progress information, and press-and-hold shelf dragging remain planned. Existing spreadsheet UI is a legacy CSV interface.
- Android original-file access needs continued real-device testing. iOS retained in-place file access is not implemented and currently reports that limitation.
- PDF Text view may change columns, tables and reading order; scanned-text OCR is not implemented.
- Expo Go development sessions require access to the running development server. A standalone offline app build is a separate delivery task.

## Earlier history

Earlier commits introduced the initial app, local library data and the shelf interface. See Git history for those changes; no earlier release tags are asserted here.
