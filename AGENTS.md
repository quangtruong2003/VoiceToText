# AGENTS.md

## Cursor Cloud specific instructions

### Overview
This is a single-package **Electron + React + TypeScript** desktop application (Voice-to-Text dictation). It is **not** a monorepo. See `README.md` for full product details.

### Running the dev environment
- `npm run dev` starts Vite dev server (port 5173) **and** launches Electron simultaneously via `vite-plugin-electron`.
- On headless Linux (Cloud Agent VM), Electron starts but D-Bus and GPU errors are expected and harmless. The React UI is accessible in Chrome at `http://localhost:5173/`.
- Hash routes: `#settings`, `#overlay`, `#history`. In browser they all render the settings view; the overlay/history views are designed for separate Electron windows.

### Type checking (no ESLint)
- There is **no ESLint** config in this project. The only static analysis is `npx tsc --noEmit`.
- Two files are excluded from TS compilation in `tsconfig.json`: `src/lib/http2-stream.ts` and `src/lib/voice-server.ts`.

### Build
- `npm run build` runs `tsc && vite build && electron-builder`. Electron-builder targets Windows NSIS only; building on Linux will skip the Windows installer.

### Native dependencies
- `@nut-tree-fork/nut-js` has native bindings for keyboard automation. It installs fine on Linux but is only usable for text injection on Windows.

### API keys
- The app needs a Google Gemini API key (or Antigravity/custom provider) for transcription. The key can be supplied via `.env` (`VITE_GEMINI_API_KEY=...`) or entered in the Settings UI at runtime. The app runs without an API key but transcription will fail.
