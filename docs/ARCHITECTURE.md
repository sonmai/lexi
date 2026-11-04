# Architecture — Lexi

## Decisions

- **One codebase:** React + TypeScript + Vite. Responsive design for Safari on iPhone and MacBook.
- **Static hosting:** Cloudflare Workers static assets (`wrangler.jsonc`), no application server and no user account.
- **Data is built separately from the app:** a scheduled GitHub Actions workflow builds the dictionaries from upstream sources and publishes them as a release archive. App builds install the archive pinned in `data.lock.json`, so a deploy never depends on upstream sites being up.
- **Two independent dictionaries:** English (Anh–Việt, Anh–Anh) and Japanese (Nhật–Việt). Each has its own version, index and chunks. A lookup reads the deployed manifest, then the one shard that contains the word.
- **Independent sense lists:** an English entry has English and Vietnamese sense arrays. Do not imply that sense number 1 in English corresponds to sense number 1 in Vietnamese.
- **Source provenance:** every dataset keeps its source, licence and attribution in the manifest and on `/sources.html`.

## Code layout

| Path | Role |
| --- | --- |
| `src/App.tsx` | Composes the page from hooks and components. |
| `src/hooks/` | Route (URL), suggestion indexes, lookups, speech. |
| `src/components/` | Search box, English and Japanese results. |
| `src/dictionary-service.ts` | Manifest and lookups. Reads the deployed data; does not store a dictionary copy. |
| `src/suggest.worker.ts`, `src/suggest-client.ts` | Parse the suggestion indexes and answer prefix queries off the main thread. |
| `src/utils/` | Pure helpers shared with tests: key normalisation, chunking, prefix search. |
| `scripts/` | Data import (`build_*.py`), packaging (`package_data.py`), install (`fetch_data.py`) and data checks (`test_*.py`). |

## Data contract

See `src/data/types.ts` and `public/dictionary/manifest.json` (generated). The manifest's top level describes the English section and `japanese` the Japanese section; each has a content-addressed `version`, an `index`, `chunks` and `bytes` (total size of that section).

Normalisation and chunk/shard selection are implemented twice, in Python for the importer and in TypeScript for the app. `tests/english.test.mjs` and `tests/japanese.test.mjs` run both implementations on the same samples. Indexes are sorted in JavaScript UTF-16 order because the app binary-searches them.

## Data pipeline

1. `.github/workflows/data.yml` (weekly, or run manually) runs `build_dictionary.py`, the data checks and `package_data.py`.
2. When the archive changed, it creates the GitHub Release `data-<en>-<ja>-<sha>` and opens a PR that updates `data.lock.json`.
3. Merging that PR deploys the new data. `npm run build` runs `fetch_data.py` first, which downloads the pinned archive once into `.cache/lexi-data`, verifies its SHA-256 and extracts it to `public/dictionary`.

Without `data.lock.json`, `fetch_data.py` falls back to building from upstream. `LEXI_SKIP_IMPORT=1` skips data, and the app then serves 16 bundled demo entries.

## Caching

Lookups always follow the deployed manifest. The suggestion index for the open dictionary is loaded once per session; a definition fetch then requests only that word's shard.

`public/_headers` marks `/dictionary/data/*` as `public, max-age=31536000, immutable`. The version is part of the path, so a new dictionary never reuses a URL and the browser and Cloudflare can keep the file. `/dictionary/manifest.json` keeps the Workers default, `public, max-age=0, must-revalidate`, so the next visit sees a new deploy.

The service worker precaches the app shell only. Dictionary files are excluded from that precache, and the worker does not intercept them. On startup the app deletes the retired offline cache names (`lexi-dictionary-v2`, `lexi-manifest-v1`) and the `lexi-offline-v1` localStorage key left by the old download button. Recent lookups stay in localStorage; that list is not dictionary data.
