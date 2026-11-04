# Lexi — Offline-first Dictionary PWA

A personal, offline-first English–Vietnamese, English–English and Japanese–Vietnamese dictionary built with React, TypeScript, Vite, and Cloudflare Workers static assets.

**Live:** https://lexi.wellprep.top

## Dictionary data

The English dictionary has **200k+ words and phrases** from four attributed sources:

- Skypedia English–Vietnamese Dictionary (enriched Vietnamese definitions, learner examples, idioms and phrasal verbs).
- Vietnamese Wiktionary through Kaikki (additional Vietnamese meanings).
- Simple English Wiktionary through Kaikki (English definitions, examples, usage labels and IPA).
- Open English WordNet 2025 (additional English definitions).

The **Japanese–Vietnamese dictionary** (about 234k entries) is searchable by kanji, kana or romaji: Vietnamese meanings from Bunchaway, Japanese definitions from Japanese Wiktionary, readings and parts of speech from JMdict, Hán Việt readings from KANJIDIC2 and example sentences from Tatoeba.

The data is rebuilt from upstream weekly by a separate workflow and pinned for deployment in `data.lock.json` (see [Data updates](#data-updates)). Lexi displays English and Vietnamese sense lists independently, with a source label on each meaning. Examples from Skypedia may be generated and have not been independently verified. See [data provenance, licensing and offline technical notes](docs/DATA_SOURCES.md) and the [attribution page](public/sources.html).

## Usage

- Search with autocomplete, arrow keys, Enter and Cmd/Ctrl+K.
- Switch between **Anh–Việt** and **Nhật–Việt**; typing kana or kanji switches to Japanese automatically, and romaji is converted to kana.
- Read English–Vietnamese and English–English meanings together, with UK/US IPA, examples and source tags.
- Read Japanese entries with readings, parts of speech, Hán Việt, Japanese definitions and Tatoeba examples.
- Share or bookmark lookups: `?q=example` or `?q=食べる&lang=ja`.
- Use Web Speech system pronunciation, if supported.
- Download each dictionary for offline use (about 82 MB English, 125 MB Japanese). A downloaded copy keeps working after data updates until you choose to update it. Browsers may evict cached data; on iPhone, add Lexi to the Home Screen to keep it longer.

## Local development

Requires Node.js 22+ and Python 3.12+.

```bash
npm install
npm run build          # installs the data pinned in data.lock.json, then builds the app
npm run preview
```

`npm run dev` and `LEXI_SKIP_IMPORT=1 npm run build` run without dictionary data, using 16 bundled demo entries. Without `data.lock.json`, `npm run build` falls back to importing from upstream sources.

Tests:

```bash
npm test                                   # unit tests, including Python/TypeScript key parity
npx playwright install chromium            # once
npx playwright test                        # browser tests with mocked dictionary data
python3 scripts/test_dictionary.py         # checks on the installed English data
python3 scripts/test_japanese.py           # checks on the installed Japanese data
```

See [Architecture](docs/ARCHITECTURE.md) for the code layout, data contract and offline design.

## Deployment

Cloudflare **Workers** (static assets) is connected to the `main` branch, and branch builds deploy Worker Previews. Wrangler is configured in `wrangler.jsonc`.

- Build command: `npm run build` (needs Python 3 to install the pinned data)
- Deploy command: `npx wrangler deploy`
- Assets output: `dist/`
- Public URL: `lexi.wellprep.top`

This project does not use a backend, user accounts, external runtime dictionary API or paid data service.

### Data updates

The **Build dictionary data** workflow (`.github/workflows/data.yml`) runs weekly and can be run manually. It builds both dictionaries (`npm run data:build`), checks them, and packages them (`npm run data:package`). When the data changed, it publishes the archive as a GitHub Release and opens a PR that updates `data.lock.json`; merging the PR deploys the new data.

The workflow needs **Settings → Actions → General → Allow GitHub Actions to create and approve pull requests** enabled.

## License

The source code is released under the [MIT License](LICENSE).

The MIT License does not cover the dictionary data: generated files under `public/dictionary/`, the published data archives and the attribution files in `public/dictionary-sources/` keep their upstream licences (CC BY-SA 4.0, CC BY 4.0, CC BY 2.0 FR, GFDL and others), listed in [DATA_SOURCES.md](docs/DATA_SOURCES.md). Hosting the site publicly distributes these files.

Skypedia states CC BY-SA 4.0 and supplies [attribution](public/dictionary-sources/SKYPEDIA_ATTRIBUTION.md). Its source material includes MinhQND and several other upstream datasets; its attribution document describes GPLv2-licensed OVDP as a reference for corrections. Please review upstream licence compatibility before republishing beyond the intended personal non-commercial use.
