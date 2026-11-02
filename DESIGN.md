# ReadList product and screen design

This document includes the original proposal and later implementation notes. For the current release, see [CHANGELOG.md](CHANGELOG.md); for outstanding work and the progress-info default (off), see [TODO.md](TODO.md).

Status: proposed design, November 2, 2026. This document and the accompanying interactive preview describe the intended app; they do not implement native reading, file access, spreadsheet exchange, or fix the existing launch/drag issues.

## Purpose

A private, fully offline library for books, novels, stories, and anime. Resume reading a local PDF/EPUB, manually record anime watched in VLC, and exchange library records in one Excel workbook. No account, analytics, remote metadata lookup, remote covers, or network dependency in the shipped app. Local-only does not by itself mean encrypted: do not promise database encryption or an app lock until implemented and verified. Explain platform backups and exported-file privacy in settings.

## Visual system

Preserve the existing dark library identity. Use covers as the memorable element, and restrained gold to indicate the primary action and active controls. Keep wooden shelves optional rather than making them the only way to browse.

| Token | Value | Role |
| --- | --- | --- |
| Ink | #0F0E11 | Main dark background |
| Binding | #18171C | Raised content and input background |
| Rule | #3D3947 | Separators and control boundaries |
| Paper | #F4F4F6 | Primary text |
| Annotation | #B7B3BF | Secondary text |
| Gold | #F5BD62 | Primary action and selected controls |

Use system sans-serif for controls and data, system serif for the ReadList wordmark, book titles, and reading text. Bundle any future custom fonts locally. Type scale: 12 supporting labels, 14 secondary text, 16 body/controls, 20 section headings, 30 screen titles; reader adjustable from 16–28. Use 4/8/12/16/24/32 spacing, 20 horizontal screen insets, 48 minimum interactive targets, 10 control radii and 16 feature-panel radii. Align text left. Let content height grow with text scaling.

Initial critique: repeated glowing cards would distract from book covers; use quiet rows and separators for settings and history. A purely decorative wooden shelf would also make mixed-media progress harder to scan; start with a readable cover/list layout and retain a shelf option for later. The preview uses clearly labelled sample records and typographic cover placeholders, never fabricated user statistics.

## Navigation and layout

Bottom tabs: Library, Insights, Settings. Tab switches are immediate; details and reader use hierarchical navigation. Plan routes under src/app when implementation begins, keeping reusable components outside that folder. Current source does not yet use Expo Router.

```text
Library                           Book / anime details
ReadList                  Add     Back                      Edit
Books | Anime                     Cover    Title / creator
Search library                    Status / format / ownership
Continue                          Continue reading / Log episode
  Cover + saved position          Progress / dates / rating
All | In progress | Planned       Notes / tags / history
Your books     Sort / Arrange     Attached file / Relink
  Covers or readable rows
Library | Insights | Settings
```

## Library and reordering

Additional agreed controls: the full list includes named presets combining an ordered title selection with category/status/search filters. An empty title selection means all titles matching those filters. Multiple selected categories/statuses use OR within their respective field; the fields and selected-title restriction combine with AND. Save and edit preset names, selections, filters, and order locally. A preset can show no results when a selected title no longer matches; keep that title in the preset definition so editing is reversible.

Shelf count is configurable as shelves per page (1–20). Preserve every title by adding pages as necessary, and render empty shelves at the end of the last page. Save the count locally. Use the shelf-layout menu to change it. Dragging is limited to visible shelves; use earlier/later controls or leave arrangement mode to change pages. Automatic edge scrolling and dragging across page boundaries are not implemented yet.

Add/edit uses searchable fields for authors, formats, statuses and categories. Categories and formats accept new values; statuses retain their defined meanings. Show only selected category chips. Reuse custom values from saved library records. A labelled Add button opens the form. The actual app now has Open PDF / EPUB in the library and Choose PDF / EPUB in the add/edit form. Read supported title/author/category metadata locally, plus PDF page count, and allow edits before Save. Missing/unreadable metadata uses a filename fallback. Files remain in their original locations. Android retains the selected content-URI grant; supported browsers store a FileSystemFileHandle. Other browsers keep a session reference and require relinking after reload. File bytes are not stored in the database. In-place iOS support requires security-scoped bookmark support in a development build. Embedded-cover extraction remains future work.

Shelves is the default layout. List uses compact rows with title/creator, categories, status/format and attachment indicators. Explicit List / Shelves controls preserve both layouts. The old header layout toggle was removed to avoid duplicating the same control.

Books and Anime are distinct collections. Search title, creator, tags, and notes; combine with status and sorting. Status values: planned, in progress, completed, on hold, dropped. Upcoming is a release flag/date, ownership is a separate field. Default to manual order with optional title/recent sorting. Continue shows the last opened book or last updated anime in the active collection. Empty states offer Add book or Add anime; failed loads offer retry without claiming the library is empty.

Arrange is explicit and available only in manual sort with no active query/status filter. Entering it exposes handles, Done, and accessible move-up/down actions. Long press the handle to drag; preserve normal row scrolling and tapping elsewhere. Native implementation must support edge autoscroll, cancel, stable IDs, and cross-row dragging. Persist a complete ordered ID list, never replace the full collection with filtered items. Show save failure and restore the previous order. Restart persistence and older Android device feel must be checked before calling the existing drag issue fixed.

## Add and edit

Add offers Book/story, Anime, and PDF/EPUB file. Manual entry requires a title; advanced fields remain optional. File selection uses the system file picker and retained original-file references. Stage file linking and metadata extraction, then show an editable review with source filename and missing-field guidance. Parse available local metadata; use filename as title fallback. Embedded PDF author/title may be absent; EPUB cover/creator/title may be absent or malformed. Never execute embedded scripts or fetch external resources. Handle cancellation, unsupported formats, corrupt files, password-protected PDFs, duplicate attachments, insufficient storage, and failed saves without changing the original files or creating duplicate entries. Local cover selection remains available.

Do not silently create a permanent record before review/save. When editing metadata, retain the file link and reading locator. An existing book can link or relink a file. Removing a library record must never delete or move the original document.

## Reader

Full reading screen; no bottom tabs. Header: Back, title, contents/reading settings. Footer: position and navigation. EPUB supports dark/light/sepia themes, font size, line spacing, table of contents, and a stable content locator (not a page number that changes when text reflows). PDF supports zoom, page navigation, fit width/page, a dark surrounding interface, and optional page inversion separately from app appearance. Page inversion can affect illustrations; make it opt-in.

Save reading position after meaningful navigation, on backgrounding, and on exit; persist locally with a debounced strategy during frequent updates. Restore after restart and after reader appearance changes. PDF page indices and EPUB locators are format-specific. User-visible progress history should record meaningful sessions, not each scroll event. Never claim a PDF page count for an EPUB that has only a computed percentage.

## Anime details

Manual season and last watched episode with optional total episode count, dates, notes, tags, and rating. Log next episode with an undo option. A season-specific episode count must not be treated as whole-series completion. Unknown totals show episode counts without a fabricated percentage. VLC playback and playback detection are outside scope.

## Insights

Separate Books and Anime summaries and history. Calculate from local records, with date-range selection. Show completed titles, pages recorded where applicable, episodes recorded, and rating summaries. Do not invent minutes watched/read without recorded duration. Handle unknown totals and empty histories. Example content in the preview is explicitly demonstration data.

## Settings and workbook exchange

Appearance: system/dark/light; reader preferences separate. Optional haptics and reduced-motion support. Data section: Import workbook, Export workbook, and export explanation. No account or sync controls.

One .xlsx with Books, Anime, Progress tabs. Use human-readable headers, stable IDs, ISO timestamps, explicit schema version, and strings for user-entered values; treat workbook contents as data, never executable instructions or formulas. Round-trip notes, dates, ratings, manual order, and locators without losing precision. Reject malformed types, duplicate IDs, invalid cross-sheet references, and impossible progress values before mutation. Escape spreadsheet formula prefixes appropriately when exporting user strings.

Books fields: schema_version, id, title, author, kind, status, upcoming, release_date, ownership, tags, rating, spice_rating, notes, total_pages, total_chapters, current_page, current_chapter, progress_percent, started_at, finished_at, sort_order, attachment_name, attachment_format, reader_locator, created_at, updated_at.

Anime fields: schema_version, id, title, creator, status, upcoming, release_date, tags, rating, notes, season, episode, total_episodes, started_at, finished_at, sort_order, created_at, updated_at.

Progress fields: schema_version, id, item_id, item_type, recorded_at, unit, previous_value, current_value, season, reader_locator, note. Progress is an event history; Books/Anime hold current state. Import validates consistency and requires review when history and current state disagree.

Import flow: choose workbook → validate sheets/headers/records → preview counts, updates, conflicts, errors and missing attachments → choose merge or replace → confirm → atomic local import. Merge matches IDs; title matching only suggests potential duplicates. Report conflicts instead of silently overwriting. Replace requires a separate destructive confirmation and a recoverable local pre-import snapshot. Invalid rows must not produce partial writes. Export takes a consistent snapshot and reports completion only after a real file has been written/shared.

The workbook contains records and saved locators, not PDF/EPUB binaries or portable absolute file paths. An imported attachment filename is a relinking hint; surface a missing-file state and let the user pick the file again. Full archive backup is a separate future feature, not part of this initial design.

## Motion and accessibility

No animated tab switching or looping effects. Brief press feedback only; sheets and reorder motion explain position/state. Native implementation should use SDK-compatible gesture/animation packages after checking Expo 58 docs. Honor reduced motion; keep text and controls stable. Include visual feedback without relying on haptics. Screen readers need explicit control names, progress descriptions, and reorder announcements. Test 320/360/390 widths, large fonts, keyboard access where supported, and readable contrast.

## Implementation gates

1. Verify Expo 58 package/config compatibility and investigate the remote-update launch failure.
2. Add routing and a migration-safe local model while preserving existing library records.
3. Implement searchable Books/Anime collections, reliable manual ordering, details and progress history.
4. Implement and round-trip-test XLSX exchange (including conflicts, formulas, corrupt workbooks and rollback).
5. Implement local attachment lifecycle, metadata review, PDF and EPUB readers, and restart-safe locators.
6. Validate offline behavior, missing/corrupt files, app background/restart, and real Android/iOS builds.

No native reader, XLSX implementation, launch repair, or native reorder repair is represented as complete by the design preview.

## Implementation progress

The repository now implements labelled Add, compact searchable entry fields, named presets, saved shelf count with pagination, and the first native drag repair using measured slots and UI-thread motion. Reordering updates order columns within a transaction rather than deleting/recreating records. Web storage also repairs legacy missing/duplicate IDs. PDF/EPUB linking, editable metadata review, an offline reader, and a compact optional row list are implemented. Browser interaction checks cover importing a local PDF, editing embedded metadata, retaining original-file handles across reloads, book creation, custom categories, presets, shelf pagination and drag persistence. Data tests cover PDF/EPUB metadata, attachment migration, stable IDs, rollback and preset matching. Real-device gesture/file-picker verification, edge autoscroll, XLSX exchange and native-device checks remain outstanding.

## Implemented reader and media updates (November 2, 2026)

Shelves opens by default; List remains available. Movies, documentaries, TV series and short films use the same offline records, presets and custom categories as books/anime. Watching statuses appear for visual media. Spice is optional: zero means Not applicable/unset, can be cleared, and is excluded from spice averages. Existing zero records retain this meaning.

The reader starts with controls hidden. Double tap (or H on a keyboard) toggles overlay controls; ordinary scroll and pinch gestures stay native. PDF pages fit the screen width and flow vertically, with only nearby pages rendered to canvases. EPUB sections flow in one vertical document with adjustable text. Rotation is unlocked in app configuration. Positions retain page/section and local scroll offset through resize, close and reopen. Original files remain in place.

Author entry accepts direct typing and keyboard Backspace/Delete, with optional saved-name suggestions. Current episode is explicit in the form, list, shelf and details. EPUB font size ranges from 14 to 40px (default 20px), saved per title and revealed with the reader controls. PDF Text view extracts selectable text into wrapping paragraphs, keeps raster illustrations at their source size capped to screen width, and offers original-page previews for vector diagrams. Scanned pages retain their page image; no OCR is implied. Original pages remains the fidelity mode for columns, tables and complex layouts.

## First-run guide and example data (v1.3)

The guide answers one question: what do I do first? It opens only when the library has never been set up, and it is two things in one sheet — a welcome choice, then three short steps.

1. **Welcome.** State what the app holds, then offer two plainly labelled choices: "Use sample titles" or "Start with an empty library." Choosing is the only setup step; there is no account, no tour of every feature, and no blocked UI behind it.
2. **Start with a title.** Point at Add and say that a title alone is enough, with creator, categories, ratings and notes optional.
3. **Find it again.** Search, status filters, Shelves/List, and presets as a saved view.
4. **Pick up where you left off.** Status and episode updates from details; attachment of a local PDF/EPUB and the saved reading position.

Rules the implementation follows:

- Skippable at every step, dismissed by Android back, and never shown twice unless the user asks for it.
- Replayable from the header Help button and from the empty library state, so the guide is not a one-shot with no way back.
- Remounted on each opening rather than reset through an effect: the modal receives a new key, so its step and library choice are derived from props and cannot fight a render.
- Written in the user's terms ("title", "library") except where the sentence is about a specific medium.

Example data is seed content, not activity. Records carry an `isSample` marker on device and in the browser store, are badged in the list and details, keep the badge when edited, and are excluded from every insight total, with a line in the insights sheet saying so. The CSV panel's reset is the only way to load examples into a library that already has records; it confirms first, states that original PDF/EPUB files are untouched, and re-marks the restored records as examples. Loading examples into a non-empty library without replacing it stays on the TODO list.

## Reader settings and optional progress (v1.4)

Theme, text size and the PDF view controls moved out of the always-visible toolbar into a settings panel opened from **Settings** in the reader controls. The toolbar keeps navigation, the chapter list and the status line; the footer keeps previous/next and the position label. This keeps the reading surface quiet while giving the settings one obvious home.

**Show reading progress** is off by default and deliberately quiet: a small pill outside the toolbar and footer, so it survives hiding the controls. PDFs show `Page 3 of 12`; EPUBs show `Section 2 of 3 · ~67%` and the settings note says the percentage is estimated from sections, never presented as a page count. No reading-time estimate is invented.

Precedence is explicit rather than hidden. A choice made inside the reader is stored with that title. Titles with no stored choice follow the app default set in Settings, and the reader offers **Use app default** to clear a per-title choice. Turning the display on or off only changes visibility; position saving is independent and is verified to stay unchanged by the toggle.

Two implementation rules matter for correctness. A pending restore survives until the document actually has a measurable layout, and scroll measurements are ignored until then — otherwise a freshly mounted frame reports the top of the document and overwrites a good saved position. And the reader never derives page numbers for EPUBs, because reflow makes them meaningless.

## Workbook exchange (implemented in v1.4)

One workbook, five sheets: **ReadList** (app name, schema version, export time, and the note that progress is a snapshot), **Books**, **Series**, **Movies**, **Progress**. Splitting by medium is what keeps units honest: pages only exist on Books rows, episodes and current episode only on Series rows, and films get their own sheet rather than being coerced into either. Columns carry stable IDs, categories, status, ratings, dates, order, relinking hints (attachment name and format) and the example marker, so importing a workbook cannot quietly turn demo data into personal statistics.

The file is a real `.xlsx` built and read in-app: fflate writes the package and @xmldom/xmldom parses it, both already used for the EPUB reader, so no spreadsheet dependency or native module is added. Cells are written as inline strings and numbers; nothing is ever executed, and a formula in an imported sheet is read as its cached value, never evaluated.

Import is deliberately staged: parse and validate the archive and sheets, map headers (accepting common aliases such as *writer* for author or *rate* for rating), reject duplicate or missing IDs, skip and report rows without a title, then show counts per medium, reading positions, how many records would be added versus updated, and any skipped rows. Only then does the user choose merge-by-ID or replace. Replace needs a second confirmation and copies the previous library into the backup box first, so an unwanted import is recoverable in the same session. Records and positions commit together, so a failure cannot leave a half-imported library.

Export is download-based on web. On device it writes into the app cache; a share sheet is still a TODO item, and the settings copy says so rather than implying the file left the app.

## Settings, backup and insights (v1.4)

The header gear opens one sheet: reading default, shelves per page, help (quick guide) and local data. Local data holds the whole personal-data story in one place: JSON backup and restore, workbook exchange and example titles.

A backup is readable JSON with records, presets, reading positions and preferences, and never the original PDF/EPUB files. The interface says so before the user relies on it. Restoring parses and validates first (shape, app marker, every title and every ID, no duplicates), reports what the file contains, then offers merge or replace; replace needs a second confirmation because it removes titles that are not in the file. Validation failures leave the library untouched, and the native path writes records and positions in one transaction.

Adding example titles is non-destructive by design: only the examples missing from the library are appended, and they keep their example marker. Replacing the whole library with examples remains a separate, confirmed action.

Insights never mix units. Each record is classified once from its `type` as book, series or movie. Pages are summed from books only, episodes from series only (watched never exceeding recorded total), and a by-media line reports the three counts. Example titles are excluded from all of it, so a fresh sample library honestly shows zero personal activity.

## Press-and-hold shelf moves (v1.4)

Arrange mode is still the explicit, fully labelled way to reorder: it shows handles and accessible earlier/later arrows. Press and hold is the quick path for one title. It uses a pan that only activates after a 420 ms hold, so a short tap still opens details, a swipe still scrolls the shelf, and a cancelled hold reorders nothing. The gesture is enabled only for the manual layout with no active search, filter or preset, which keeps an automatic sort from being silently overwritten. A successful drop runs through the same merge-and-save path as Arrange mode, so IDs, attachments and progress are preserved and a failed save restores the previous order.

Deliberately not done yet: edge autoscroll, a highlighted drop target, and cross-page moves. They are listed in TODO.md rather than implied by the gesture. Web is covered by a mouse-driven browser check; touch behaviour on a phone still needs device verification.
