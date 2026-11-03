# Lexi — English Dictionary PWA

A personal, offline-first English–Vietnamese and English–English dictionary built with React, TypeScript, Vite, and Cloudflare Workers static assets.

**Live:** https://lexi.wellprep.top

## Dictionary data

The production build currently assembles **200k+ English words/phrases** from four attributed sources:

- Skypedia English–Vietnamese Dictionary (enriched Vietnamese definitions, learner examples, idioms and phrasal verbs).
- Vietnamese Wiktionary through Kaikki (additional Vietnamese meanings).
- Simple English Wiktionary through Kaikki (English definitions, examples, usage labels and IPA).
- Open English WordNet 2025 (additional English definitions).

It also includes a **Japanese–Vietnamese dictionary** (about 234k entries) searchable by kanji, kana or romaji: Vietnamese meanings from Bunchaway, readings and parts of speech from JMdict, Hán Việt readings from KANJIDIC2 and example sentences from Tatoeba. Run `python3 scripts/build_japanese.py` to build only that part.

The dataset is generated during deployment and may change upstream. Lexi displays English and Vietnamese sense lists independently, with a source label on each meaning. Examples from Skypedia may be generated and have not been independently verified. See [data provenance, licensing and offline technical notes](docs/DATA_SOURCES.md) and the [attribution page](public/sources.html).

## Local development

Requires Node.js 22+ and Python 3.12+.

```bash
npm install
npm run build
python3 scripts/test_dictionary.py
npm run preview
```

To start the UI using the original 16 demo entries without downloading dictionaries, use `npm run dev` in a clean checkout or `LEXI_SKIP_IMPORT=1 npm run build` for the local demo build. The data importer runs automatically before production builds.

## Usage

- Search with autocomplete, arrow keys, Enter and Cmd/Ctrl+K.
- Read English–Vietnamese and English–English meanings together.
- View available UK/US IPA, word examples and source tags.
- Use Web Speech system pronunciation, if supported.
- Optional download for offline lookups. Browsers may evict cached data.

## Deployment

Cloudflare **Workers** (static assets) is connected to the `main` branch. Wrangler is configured in `wrangler.jsonc`.

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Assets output: `dist/`
- Public URL: `lexi.wellprep.top`

This project does not use a backend, user accounts, external runtime dictionary API or paid data service.

## Important licence note

Skypedia states CC BY-SA 4.0 and supplies [attribution](public/dictionary-sources/SKYPEDIA_ATTRIBUTION.md). Its source material includes MinhQND and several other upstream datasets; its attribution document describes GPLv2-licensed OVDP as a reference for corrections. Please review upstream licence compatibility before republishing beyond the intended personal non-commercial use. Hosting publicly still amounts to distribution of downloaded dictionary files.

The UI source code and third-party lexical content have different licence obligations.
