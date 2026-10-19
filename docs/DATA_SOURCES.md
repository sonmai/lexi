# Real data and offline delivery

The importer is scripts/build_dictionary.py (Python 3 standard library).

## Source selection

- Vietnamese: https://kaikki.org/viwiktionary/raw-wiktextract-data.jsonl.gz
  - English headwords with Vietnamese glosses from the Vietnamese Wiktionary edition.
  - Attribution and licence: Wiktionary CC BY-SA/GFDL, see public/sources.html.
- English: https://en-word.net/static/english-wordnet-2025.xml.gz
  - Open English WordNet 2025, CC BY 4.0 with Princeton WordNet attribution.

We deliberately do not incorporate Skypedia/MinhQND's repackaged SQLite material without resolving all upstream licensing.

## Build

Run npm install, then npm run build. The prebuild script downloads both upstream datasets and generates public/dictionary. This directory is gitignored. Built assets include a manifest, sorted word index, and letter-sharded English and Vietnamese senses.

Source hashes are used in asset paths for safe cache updates. Run LEXI_SKIP_IMPORT=1 npm run build for an offline demo build with the 16 existing fixtures. The ordinary npm run dev uses fixtures until the full data is generated.

The importer enforces a minimum of 100,000 unique headwords and Cloudflare Pages per-file asset size check. Builds require time for two downloads (about 44MB compressed), extraction, and frontend compilation.

## Offline behaviour

The service worker precaches application code, not all dictionary shards. The manifest uses NetworkFirst; versioned index and shards use CacheFirst. First online lookup caches the relevant letter shard. Download for offline use caches the complete dictionary. Browsers may evict cached data; users can download again.

## Test checklist

Use npm run preview after a production build. Test: online lookup, two-language results, missing words, first-visit offline reload, full offline download, offline search for unvisited words, and version upgrade. Test on Safari iOS and desktop browsers.
