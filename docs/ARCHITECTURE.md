# Architecture — Lexi

## Decisions

- **One codebase:** React + TypeScript + Vite. Responsive design for Safari on iPhone and MacBook.
- **Static hosting:** Cloudflare Pages, no application server and no user account.
- **Offline first:** vite-plugin-pwa precaches production application assets. The initial demo dataset is bundled with the JS app, so lookups work offline after installation/cache completion. Browser storage may be cleared by the OS.
- **Two independent dictionaries:** an entry contains English and Vietnamese sense arrays. Do not imply that sense number 1 in English corresponds to sense number 1 in Vietnamese.
- **Source provenance:** demo data is original. A future importer must retain source, licence, attribution, dataset version, and terms for each imported dataset.

## Data contract

See `src/data/types.ts`. The production build should generate static, versioned, compressed assets from a reproducible import script. Do **not** bundle a full multi-megabyte dictionary in the main JS bundle; lazy-load dictionary chunks/indexes and cache their version.

## Future full-dataset ingestion

1. Review licences and derivation chains for English–Vietnamese datasets.
2. Review Open English WordNet/Wiktionary licences and contents.
3. Build a normalized headword index and independent `en`/`vi` sense collections.
4. Partition dataset by prefix, ship compressed chunks, and provide a visible “Download offline dictionary” flow.
5. Record publication date and attribution in app UI; add schema and fixture checks.
6. Test offline launch and first-search UX in Safari iOS and desktop browsers.

The current UI is a **prototype with a small curated dataset**, not a full dictionary and not a complete offline-download implementation for production-scale data.
