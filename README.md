# Lexi · English Dictionary

A clean, offline-first **English–Vietnamese + English–English** dictionary PWA designed for iPhone and MacBook, using a single React codebase.

## Status

**Design prototype.** The app currently ships **16 original demonstration entries** to validate layout, search, bilingual definitions, pronunciation, accessibility, and PWA caching. It does **not** yet ship a production dictionary dataset.

## Run locally

Requires Node.js 22+.

```bash
npm install
npm run dev
```

Open the local Vite URL shown in the terminal.

```bash
npm run typecheck
npm run build
npm run preview
```

Use `npm run preview` (production build) to verify service-worker/offline behaviour. Service workers are not active in the normal Vite dev experience.

## Features in prototype

- One search field with live headword suggestions and keyboard arrow navigation
- English–Vietnamese and English–English definitions shown together
- IPA when available and system text-to-speech
- Responsive phone/desktop layout and Cmd/Ctrl+K shortcut
- Installable PWA manifest and precached bundled demo definitions
- No backend, authentication, analytics, or paid APIs

## Deployment to Cloudflare Pages

Connect this GitHub repository to **Workers & Pages → Create → Pages → Connect to Git**.

- Framework preset: **Vite**
- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: repository root

Cloudflare will allocate a `<project>.pages.dev` domain. Check its availability before committing to a name.

## Planned next step: production data

Replace the demo data with separately sourced and legally reviewed dictionaries. Store source/licence/attribution metadata, generate indexed static chunks, and design offline download/updates before including large data files.

See [architecture and data decisions](docs/ARCHITECTURE.md).
