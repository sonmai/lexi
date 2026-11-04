# Architecture — Lexi

## Decisions

- **One codebase:** React + TypeScript + Vite. Responsive design for Safari on iPhone and MacBook.
- **Static hosting:** Cloudflare Workers static assets (`wrangler.jsonc`), no application server and no user account.
- **Data is built separately from the app:** a scheduled GitHub Actions workflow builds the dictionaries from upstream sources and publishes them as a release archive. App builds install the archive pinned in `data.lock.json`, so a deploy never depends on upstream sites being up.
- **Two independent dictionaries:** English (Anh–Việt, Anh–Anh) and Japanese (Nhật–Việt). Each has its own version, index and chunks, and is downloaded for offline use separately.
- **Independent sense lists:** an English entry has English and Vietnamese sense arrays. Do not imply that sense number 1 in English corresponds to sense number 1 in Vietnamese.
- **Source provenance:** every dataset keeps its source, licence and attribution in the manifest and on `/sources.html`.

## Code layout

| Path | Role |
| --- | --- |
| `src/App.tsx` | Composes the page from hooks and components. |
| `src/hooks/` | Route (URL), suggestion indexes, lookups, offline downloads, speech. |
| `src/components/` | Search box, offline button, English and Japanese results. |
| `src/dictionary-service.ts` | Manifest, lookups, offline download, version pinning and cache pruning. |
| `src/suggest.worker.ts`, `src/suggest-client.ts` | Parse the suggestion indexes and answer prefix queries off the main thread. |
| `src/utils/` | Pure helpers shared with tests: key normalisation, chunking, prefix search. |
| `scripts/` | Data import (`build_*.py`), packaging (`package_data.py`), install (`fetch_data.py`) and data checks (`test_*.py`). |

## Data contract

See `src/data/types.ts` and `public/dictionary/manifest.json` (generated). The manifest's top level describes the English section and `japanese` the Japanese section; each has a content-addressed `version`, an `index`, `chunks` and `bytes` (total download size).

Normalisation and chunk/shard selection are implemented twice, in Python for the importer and in TypeScript for the app. `tests/english.test.mjs` and `tests/japanese.test.mjs` run both implementations on the same samples. Indexes are sorted in JavaScript UTF-16 order because the app binary-searches them.

## Data pipeline

1. `.github/workflows/data.yml` (weekly, or run manually) runs `build_dictionary.py`, the data checks and `package_data.py`.
2. When the archive changed, it creates the GitHub Release `data-<en>-<ja>-<sha>` and opens a PR that updates `data.lock.json`.
3. Merging that PR deploys the new data. `npm run build` runs `fetch_data.py` first, which downloads the pinned archive once into `.cache/lexi-data`, verifies its SHA-256 and extracts it to `public/dictionary`.

Without `data.lock.json`, `fetch_data.py` falls back to building from upstream. `LEXI_SKIP_IMPORT=1` skips data, and the app then serves 16 bundled demo entries.

## Offline

- The service worker precaches the app shell (including the suggestion worker). Dictionary files are cached at runtime in `lexi-dictionary-v2`, and the "Tải từ điển offline" button downloads every file of the current dictionary into the same cache.
- A completely downloaded section is **pinned** in `localStorage` (`lexi-offline-v1`). Lookups keep using the pinned version after a newer one is deployed, and the button offers "Cập nhật bản offline" instead of silently losing offline support.
- Lookups read the cache before the network, so pinned data also works when the service worker is not in control. If a pinned copy has been evicted, it is unpinned and the deployed data is used.
- After a download and on start-up, files that belong to neither a pinned nor the deployed version are deleted.
- Downloads check `navigator.storage.estimate()` first and request `navigator.storage.persist()`. If persistence is refused, the app explains that the browser may evict the data (Safari evicts data of sites not added to the Home Screen after 7 days without use).
