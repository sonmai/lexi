# Lexi dictionary data — v3

## Active datasets

Lexi is a personal, non-commercial English–Vietnamese and English–English PWA, but **the hosted site is publicly accessible**. All redistributed data must comply with its source licences.

1. **Skypedia English–Vietnamese** — [source](https://github.com/skypediacode/english-vietnamese-dictionary); [attribution](https://github.com/skypediacode/english-vietnamese-dictionary/blob/main/ATTRIBUTION.md). CC BY-SA 4.0 as claimed by the maintainer. Built from MinhQND and other upstream dictionaries; example sentences are generated/curated and *not guaranteed correct*. Skypedia describes consulting GPLv2-licensed OVDP to correct words; this chain should be reviewed before wider redistribution.
2. **Vietnamese Wiktionary / Kaikki** — https://kaikki.org/viwiktionary/rawdata.html . CC BY-SA/GFDL terms as applicable.
3. **Simple English Wiktionary / Kaikki** — https://kaikki.org/simplewiktionary/rawdata.html . Provides everyday English definitions, examples, usage tags and IPA (when present); CC BY-SA/GFDL as applicable.
4. **Open English WordNet 2025** — https://en-word.net/ . CC BY 4.0 plus Princeton WordNet original licence.

The default build uses **Simple English Wiktionary**, not the much larger full English Wiktionary (3+ GB uncompressed). You may override `LEXI_EN_WIKTIONARY_SOURCE` with a compatible compressed raw extraction for a more comprehensive experiment. No provider's examples are asserted to be human verified.

### Import command

```bash
npm install
npm run build
python3 scripts/test_dictionary.py
```

`prebuild` calls `scripts/build_dictionary.py`. All data downloads occur at build time; the API is not called at runtime. The original downloads are not committed. Data shards are exported to `public/dictionary/data/<version>/<prefix>.json`, accompanied by a sorted index and manifest. The first two letters of an English key determine its shard; `other` handles unusual initial symbols.

The build version is content-addressed based on SHA-256 digests of four downloaded datasets. GitHub Actions validates total counts, bilingual coverage for common headwords, example totals, source attribution metadata, and shard integrity. The last successful dataset evaluation returned **215,761 headwords / 175,860 VI examples / 79,991 EN examples**. These are counts, *not* an accuracy audit.

The generated dataset is an adaptation derived in part from CC BY-SA material and is supplied under the applicable original and share-alike terms. Application code is independent. The original [Skypedia attribution](../public/dictionary-sources/SKYPEDIA_ATTRIBUTION.md) is preserved verbatim and the [in-app sources page](../public/sources.html) links to its licence.

### Offline

The app and search index are cached separately from the data shards. Data chunks are partitioned into 2-character prefixes to avoid huge single downloads on iPhone. Users can optionally cache all shards in Cache Storage. Storage quotas, eviction, and caching differ between browsers, so an offline download is best-effort, not a promise of permanent storage. The Service Worker runtime cache and offline download code both use `lexi-dictionary-v2`.

### Responsible quality improvements

- Sample-check everyday words, multiple-meaning verbs (run, take, get), idioms and phrasal verbs.
- Report machine-generated examples that are unnatural or inconsistent with the meaning.
- Do not conflate the English and Vietnamese ordering of senses.
- Prefer source metadata instead of inventing sense alignments or translations.
- Filter nonsense entries without deleting valid specialized terms blindly.
