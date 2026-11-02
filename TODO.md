# ReadList TODO

Updated: 2026-11-02. This checklist describes planned work, not shipped features. See [CHANGELOG.md](CHANGELOG.md) for the current implementation and [DESIGN.md](DESIGN.md) for the intent behind it.

## Product priority: make first use obvious

- [ ] Test onboarding with a first-time user: check they can add a book, add a movie/series, find a title, update status, reopen a reading file and reopen the guide from the empty library state without needing outside explanation.
- [ ] Check the guide and the settings sheet on a physical phone: small screens, 200% text, landscape, screen reader, and the Android back button. The guide check runs in the browser at 390×844 only; the reader surface additionally covers 360×640 and 640×360.

## Next: reader progress on a physical phone

- [ ] Run [PHONE-CHECK §2](docs/PHONE-CHECK.md) on a physical phone: progress-off startup, enabled/disabled persistence, double-tap, pinching, scrolling, landscape and large text. Browser coverage includes 360×640 and 640×360 for panel fit, switch reachability, pill/footer overlap, progress text and two-finger resizing, but browser rendering is not device rendering.
- [ ] Confirm on a real handset that the settings panel does not cover the reading area uncomfortably in landscape, and that the on-screen keyboard is never needed to reach its controls.
- [ ] Check that the platform handset does not zoom the whole page during a pinch (we disable page zoom in the reader); if a device ignores it, the two-finger resize will fight the OS gesture.

## Next: press-and-hold selection and shelf dragging

- [ ] Show a highlighted drop target before the drop; the lift state, haptics and the screen-reader announcement after the drop are already in place.
- [ ] Support edge autoscroll and an intentional way to move between shelf pages while dragging.
- [ ] Test long press, scrolling conflicts, cancellation, outside drops and persistence on Android and iOS, and confirm the browser behaviour matches.

## Spreadsheet exchange and data portability

- [ ] Separate current progress from an event history of reading/watching updates. The workbook's Progress sheet holds current positions only; a full event history is not implemented.
- [ ] Share an exported workbook out of the app on Android/iOS. Export currently downloads on web and writes to the app cache on device, without a share sheet.
- [ ] Take an explicit snapshot before a *JSON* restore that replaces the library (workbook replace already copies the previous library into the backup box).
- [ ] Verify the exported workbook in Microsoft Excel and Apple Numbers. It is already read cleanly by openpyxl (a strict OOXML consumer): five sheets, typed numbers, escaped strings and the example marker, after the default cell style was added to the package. LibreOffice is not installed on the development machine.

## File access and reader reliability

- [ ] Verify retained Android access after process death, restart, device reboot and file-provider permission changes.
- [ ] Implement retained in-place iOS file access/bookmarks in a development build, preserving the no-copy requirement.
- [ ] Exercise long/large files, missing or renamed files, corrupt documents, image-heavy EPUBs, multicolumn PDFs, tables and vector diagrams on real devices.
- [ ] Improve PDF reflow ordering and figure placement while retaining Original pages as the exact-layout option.
- [ ] Decide whether password-protected PDFs get real support. Today the reader rejects them with a clear message, and OCR for scans is deliberately out of scope.
- [ ] Measure memory use while reading large PDFs and while switching font size or PDF view. Reading-position stability across resize and font changes is already covered by the browser check.

## Settings, insights and release readiness

- [ ] Check accessibility: screen readers, contrast, large text, keyboard author editing, touch targets and reduced motion. Labels were added to the new settings and statistics controls, but no screen-reader or contrast pass has been done.
- [ ] Complete physical-device smoke tests for picking/relinking files, offline reading, current episodes and shelf gestures.
- [ ] Prepare and test a standalone offline Android build and a supported iOS build. Expo Go is a development preview that needs the development server.
- [ ] Decide whether to encrypt the local database or offer an app lock. Neither is implemented, and the README says so rather than implying protection.

## Standing practices

These are checks repeated every release, not one-off tasks. Their current evidence is recorded so the next release can repeat them instead of rediscovering them.

- Changelog and checklist stay current: every user-visible change is in `CHANGELOG.md` and verified items move to Completed in this file.
- Generated reader modules stay in sync: `npm run reader:build` must leave `src/reader/pdfRuntime.js` and `src/reader/pdfReflowRuntime.js` byte-identical unless their sources changed (verified at v1.4).
- Dependencies stay aligned: `npx expo-doctor` and `npx expo install --check` pass (20/20 at v1.4), and lint, `lint:node` and typecheck run before a release. See [docs/RELEASE.md](docs/RELEASE.md).

## Completed

### v1.4 — 2026-11-02

- [x] Replace the legacy pasted-CSV workflow with real `.xlsx` import/export. The CSV panel and its export helper are removed; Settings now exports and imports a workbook.
- [x] Use one workbook with ReadList (metadata), Books, Series (anime/TV), Movies and Progress sheets, so pages and episodes are never mixed and films have their own sheet.
- [x] Include stable IDs, categories, status, ratings, dates, page/episode counts, current episode, order, relinking hints (attachment name/format) and the example marker, so a re-import cannot promote examples to personal records.
- [x] Export records and relinking hints only; the workbook never embeds PDF/EPUB bytes.
- [x] Preview imports with counts, new-versus-update numbers and skipped rows; merge or replace, with replace requiring a second confirmation and the previous library copied into the backup box first.
- [x] Await the whole import before reporting success: records and reading positions commit together, and a rejected import leaves the library untouched (unit-tested).
- [x] Verify round trips, duplicate records, empty fields, Unicode, malformed workbooks, duplicate IDs, missing headers and aliased header names, plus a real browser export→re-import.

- [x] Add a two-finger pinch in the reader to resize text (EPUB and PDF Text view) and to zoom PDF Original pages, instead of zooming the whole page. Verified in `tests/reader-ui.mjs` with synthetic two-pointer events; touch behaviour on a real handset still needs the phone pass.
- [x] Extend the browser reader checks to 360×640 and 640×360: the settings panel fits and stays reachable, the progress pill clears the footer, and the progress text survives rotation.
- [x] Add [docs/PHONE-CHECK.md](docs/PHONE-CHECK.md), a step-by-step manual pass for the device-only items, and point the remaining TODO entries at it.
- [x] Announce the result of a shelf drop to screen readers.

- [x] Let the user press and hold a title on a shelf to move it without first opening Arrange mode, using a long-press-activated pan so a short tap still opens details and a swipe still scrolls. Covered by `tests/ui.mjs` at 390×844 (mouse) only.
- [x] Keep the move limited to the manual layout, preserve the existing reorder merge/rollback (which keeps IDs, attachments and progress), and retain the accessible earlier/later arrows in Arrange mode.
- [x] Fix lost reading positions after relinking a moved document. The restore now waits until the document is measurable and scroll measurements are ignored until it applies; `tests/reader-ui.mjs` passes this assertion that failed in v1.3.
- [x] Add a reader settings panel reachable from the reader controls, containing theme, text size and the PDF Original pages / Text view / Fit width / Invert pages controls.
- [x] Add **Show reading progress**, off by default: PDF page/total, EPUB section/total with an approximate percentage labelled as section-based. It sits outside the toolbar and footer so it stays visible with controls hidden.
- [x] Persist the progress choice per title, keep an app-wide default for titles never changed, offer "Use app default" to clear a per-title choice, and leave the saved reading position untouched when toggling it.
- [x] Add a dedicated settings surface for reader defaults, shelves per page, guide replay, spreadsheet tools and local data.
- [x] Split insights by media: pages from books, episodes from series, plus book/series/movie counts; example titles stay excluded.
- [x] Add a local backup and restore flow (JSON with records, presets, reading positions and preferences), explain that original files are excluded, validate before writing, and require a second confirmation to replace the library.
- [x] Add example titles into an existing library without wiping records, while keeping the replace-everything action confirmed.
- [x] Give `tests/**` and `scripts/**` a Node-aware ESLint configuration and wire `lint:node`, `test:ui` and `test:reader` npm scripts.
- [x] Record the Windows write-permission repair in the README troubleshooting notes.

- [x] Verify the browser session-only file path: the UI test runs without the File System Access API, imports a PDF, and now asserts the in-form warning that the link cannot be retained and will need relinking.
- [x] Write install, run, verification and troubleshooting instructions in [docs/RELEASE.md](docs/RELEASE.md), including the Windows `lightningcss` repair and the `spawn EPERM` sandbox note, with `npx expo-doctor` (20/20) as the dependency gate.
- [x] Confirm the generated reader modules are in sync: a rebuild leaves `src/reader/pdfRuntime.js` and `src/reader/pdfReflowRuntime.js` byte-identical.
- [x] Validate the exported workbook with a strict OOXML reader (openpyxl): five sheets, typed numbers, escaped strings and the example marker. This found a missing default cell style, now added to the package.

### v1.3 — 2026-11-02

- [x] Add a short, optional first-run guide that explains the library, adding a title, changing status and resuming progress. The guide is skippable, dismissible, and replayable from the header Help button and from the empty library state. `tests/ui.mjs` covers first run, finishing the guide, header replay and the fact that replay does not re-offer the library choice; the empty-state link, Android back and physical-device behaviour are still unverified, so they stay on the list below.
- [x] Let first-time users choose a clearly labelled example library or an empty library. Example records carry an `isSample` flag, are badged on the shelf, in the list and in details, and are excluded from every insight total. Unit tests assert the marker is written and read back; the insights exclusion is checked by hand and by the screenshots in `.expo/verification`, not by an automated assertion.
- [x] Use media-neutral wording in shared screens and empty states ("title", "library"): empty states, list and card headers, shelf arrangement controls, delete and save alerts, CSV reset and import messages, reader loading/error text, and the untitled-record fallback. Media-specific words remain where the action is about that medium (format names, "Read attached book"), and the legacy CSV column header stays "Book" because it is a data field name in the old spreadsheet format, not UI copy.
- [x] Keep onboarding brief: a welcome choice plus three steps, no account or setup, with the library usable immediately.
- [x] Fix the failing native library test (identical data-URL modules were served from the module cache) and the `setState`-in-effect lint error in the guide.
