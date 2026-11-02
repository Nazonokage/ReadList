# Install, run and verify ReadList

This is the reproducible path from a clean checkout to a running app and a verified change. It does not describe an app-store release; the standalone build is still a TODO item.

## Requirements

- Node.js 20+ and npm (the project uses `package-lock.json`, not a Bun lockfile).
- Android: a device or emulator with USB debugging, or Expo Go for a quick look at the JS-only parts.
- iOS: macOS with Xcode, or EAS Build.
- Windows note: the web bundler needs a working `lightningcss` native binary. A truncated install is a known Windows failure (see [Troubleshooting](#troubleshooting)).

## Install

```bash
npm ci
npx expo install --check     # reports SDK-incompatible package versions
npx expo-doctor              # 20 project checks, including dependency alignment
```

`expo-doctor` passing on this checkout (20/20) is the dependency-alignment gate. If it reports a mismatch, run `npx expo install --fix` and re-run both commands.

## Run

```bash
npm start          # Expo dev server, choose a target
npm run web        # browser
npm run android    # device/emulator
npm run ios        # macOS only
```

A standalone offline app is **not** produced by these commands. Expo Go needs the running dev server, and native modules such as the file picker and SQLite need a development build (`npx expo run:android`, `npx expo run:ios`, or `eas build --profile development`).

## Verify a change

```bash
npm run typecheck    # tsc --noEmit
npm run lint         # app code (expo lint)
npm run lint:node    # tests/ and scripts/ (Node globals, no app rules)
npm test             # data, storage, backup and workbook tests
```

Browser checks need a web export and Microsoft Edge:

```bash
npx expo export --platform web --output-dir dist
npm run test:ui       # library, guide, settings, backup, workbook, shelves
npm run test:reader   # PDF/EPUB rendering, positions, reader settings, pinch
```

Set `READLIST_DIST` to serve a different export directory.

Regenerate the bundled PDF runtime only after changing `src/reader/document.js` inputs or the generator:

```bash
npm run reader:build
```

A rebuild must leave `src/reader/pdfRuntime.js` and `src/reader/pdfReflowRuntime.js` byte-identical unless you changed their sources; that identity is the "generated files are in sync" check.

## Troubleshooting

### `lightningcss` or web bundling fails on Windows

The npm install can leave a truncated `lightningcss-win32-x64-msvc` package. Reinstall just that package (`npm install lightningcss-win32-x64-msvc@<version>`) and re-run `npx expo export --platform web`. The v1.2 changelog records the same repair.

### Writes fail inside the project but the repo root works

A sandboxed shell at low integrity can only write where its own identity has an allow entry. If existing folders deny writes, grant the signed-in user full control on the workspace root and then grant the sandbox identity modify rights across the existing folders. See the README troubleshooting note. Running the tools from a normal terminal avoids it.

### `npm test` fails with `spawn EPERM`

The Node test runner spawns a child per file with piped stdio, which a restricted sandbox blocks. Run the suite from a normal terminal, or `node --test --test-isolation=none tests/library.test.mjs` to run in-process.

## What is still missing before a release

See `TODO.md`: a tested standalone Android build and a supported iOS build, physical-device smoke tests, accessibility passes, workbook sharing on device, and the device checklist in [PHONE-CHECK.md](PHONE-CHECK.md).
