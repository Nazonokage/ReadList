# ReadList physical phone checklist

Nothing in this repository has been verified on a physical phone. The automated checks run in desktop Chromium (and Microsoft Edge for the browser suites) at 390×844, 360×640 and 640×360, which is not device coverage. This file turns the remaining device work in `TODO.md` into a short manual pass.

Record what you used (device, OS version, build type) and any failure with the step number. If a step fails, note whether the app crashed, a control was unreachable, or the result was merely ugly.

## Before you start

1. Install a development build (`npx expo run:android`, `npx expo run:ios`, or `eas build --profile development`). Expo Go is enough to look at layout, but file access and the reader need the real build.
2. Have one small PDF (a few pages) and one EPUB with at least two chapters on the device.
3. Optionally set the system text size to its largest value for the second pass.

## 1. First run (TODO: make first use obvious)

| Step | Expected |
| --- | --- |
| Open the app for the first time | Welcome sheet appears above an empty library; both choices are reachable one-handed |
| Choose "Use sample titles" | Guide advances to step 1; shelf shows examples with an EXAMPLE badge |
| Finish the guide | Guide closes; library stays usable; no account or setup prompt appears |
| Reload the app | Guide does not reappear; Help still opens it |
| Press Android back while the guide is open | Guide closes, app does not exit |
| Set text to 200% and repeat the guide | Text wraps, buttons stay reachable, nothing is clipped |
| Rotate to landscape with the guide open | Sheet stays scrollable; both choices remain visible |

## 2. Reader settings and progress (TODO: reader progress on a physical phone)

Open an EPUB, then a PDF.

| Step | Expected |
| --- | --- |
| Double tap the reading area | Controls appear; a Settings button is present |
| Open Settings | Panel fits on screen in portrait and landscape; the progress switch, theme, text size and PDF view controls are all reachable without the keyboard |
| Leave progress off, scroll, close and reopen | No progress pill anywhere; the reading position is still restored |
| Turn progress on, hide the controls | Pill stays visible; EPUB shows `Section n of m · ~x%`, PDF shows `Page n of m` |
| Scroll to the end of a chapter and back | The percentage moves with the section; it never claims a page count for an EPUB |
| Close and reopen the same title | Progress is still on for that title |
| Open a different title never changed in the reader | Progress follows the app default (Settings), not the other title's choice |
| Rotate with progress on | Pill stays inside the screen and never covers Previous/Next |
| Pinch with two fingers on the text | Text gets bigger/smaller; the page itself does not zoom; one-finger scrolling still works |
| Pinch on a PDF in Original pages | Zoom changes when the fingers lift; columns stay aligned |
| Press "Use app default" after changing it per title | Title follows the app default again |
| Turn progress on/off again | Reading position is unchanged by the toggle |

Note any point where the pill overlaps text unreadably, or the settings panel covers more of the page than is comfortable.

## 3. Press-and-hold shelf move (TODO: press-and-hold selection)

| Step | Expected |
| --- | --- |
| Tap a spine | Details open |
| Swipe the shelf | It scrolls; nothing is selected |
| Press and hold a spine for about half a second | Title lifts (scale/shadow); haptic fires; page stops scrolling |
| Drag over another title and release | Order changes, details do not open, Arrange mode is not entered |
| Press and hold, then release without moving | Nothing reorders; details do not open |
| Repeat in Arrange mode | Handle drag still works; Earlier/Later arrows still work |
| Repeat with a search or preset active | Press and hold does nothing (arrangement stays disabled) |
| Use a screen reader | The moved title announces its new position |

Edge autoscroll and a highlighted drop target are not implemented yet, so do not expect them.

## 4. Local data (Settings)

| Step | Expected |
| --- | --- |
| Settings → Download/Create backup | A JSON file (web) or the copyable text (native) contains records but no PDF/EPUB bytes |
| Clear the library, restore the backup (merge) | Records return; duplicate IDs are impossible |
| Restore with replace | Requires the second confirmation; titles not in the backup are gone |
| Paste a broken file and press Check backup | A clear message, and the library is untouched |
| Add example titles to a library that already has records | Only missing examples are appended; your records are unchanged |
| Settings → Export workbook | A `.xlsx` file is produced; on device it is written to the app cache (there is no share sheet yet), and the message says where |
| Settings → Import workbook → pick that file | A preview shows titles per sheet, positions, added/updating counts and skipped rows |
| Merge the workbook | Records merge by ID; nothing is duplicated |
| Replace with the workbook | Needs a second confirmation, and the previous library appears in the backup box |
| Open the exported file in Excel/Numbers/LibreOffice | Sheets and values read correctly; no cell contains a broken string |

## 5. Files and reading (existing TODO items)

| Step | Expected |
| --- | --- |
| Link a PDF, read, close the app fully, reopen | The file still opens without relinking (Android grant retained) |
| Move or rename the file outside the app, then open the title | A relink prompt appears, and relinking resumes at the saved position |
| Open a large PDF (50+ pages) | Rendering stays responsive; memory does not grow without bound |
| Open an EPUB with images and a table | Content renders offline; no external request is made |
| Try a password-protected PDF | A clear "not supported" message |
| Read in landscape, change text size, rotate back | Position is stable |

## Reporting

If something fails, capture: the step number, the device and OS, whether it was Expo Go or a development build, and (where possible) a screenshot and the exact text shown. Add the failure to `TODO.md` rather than fixing it silently in this file.
