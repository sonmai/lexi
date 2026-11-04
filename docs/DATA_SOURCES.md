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
npm run data:build     # download upstream sources, build both dictionaries and check them
npm run data:package   # archive public/dictionary and pin it in data.lock.json
```

The `Build dictionary data` workflow runs these weekly and publishes the archive as a GitHub Release; app builds (`prebuild` → `scripts/fetch_data.py`) only install the pinned archive. See [ARCHITECTURE.md](ARCHITECTURE.md#data-pipeline). All data downloads occur at build time; the API is not called at runtime. The original downloads are not committed. Data shards are exported to `public/dictionary/data/<version>/<prefix>.json`, accompanied by a sorted index and manifest. The first two letters of an English key determine its shard; `other` handles unusual initial symbols.

The build version is content-addressed based on SHA-256 digests of four downloaded datasets. GitHub Actions validates total counts, bilingual coverage for common headwords, example totals, source attribution metadata, and shard integrity. The last successful dataset evaluation returned **215,761 headwords / 175,860 VI examples / 79,991 EN examples**. These are counts, *not* an accuracy audit.

The generated dataset is an adaptation derived in part from CC BY-SA material and is supplied under the applicable original and share-alike terms. Application code is independent. The original [Skypedia attribution](../public/dictionary-sources/SKYPEDIA_ATTRIBUTION.md) is preserved verbatim and the [in-app sources page](../public/sources.html) links to its licence.

## Japanese–Vietnamese datasets

Built by `scripts/build_japanese.py`, which `build_dictionary.py` calls after the English data. Run it directly (`python3 scripts/build_japanese.py`, then `python3 scripts/test_japanese.py`) to rebuild only the Japanese section; every source URL can be overridden with a `LEXI_JMDICT_SOURCE`-style variable, including `file://` paths.

1. **JMdict** via [jmdict-simplified](https://github.com/scriptin/jmdict-simplified) — [EDRDG](https://www.edrdg.org/jmdict/j_jmdict.html), CC BY-SA 4.0. Entry structure, kanji/kana forms and parts of speech; its English glosses are not shipped. The release is pinned with `LEXI_JMDICT_RELEASE`.
2. **Bunchaway Japanese–Vietnamese Dictionary** — https://github.com/bunchaway/tu-dien-nhat-viet , CC BY-SA 4.0 as stated in its README (the repository has no licence file). About 360k headwords keyed by written form, with numbered Vietnamese meanings and no readings. It covers almost all of JMdict and its uniform style suggests it was produced with machine assistance from JMdict; it has not been independently verified.
3. **Japanese Wiktionary** via [kaikki.org](https://kaikki.org/jawiktionary/rawdata.html) (Wiktextract raw data) — https://ja.wiktionary.org/ , CC BY-SA 4.0. Monolingual Japanese definitions, shown as "Nhật – Nhật" under the Vietnamese meanings (up to 12 per entry). About 127k Japanese headwords; with the 2026-11-01 dump about 85% of JMdict's common entries get definitions. Wiktionary keeps every sense, including slang and vulgar ones.
4. **KANJIDIC2** — [EDRDG](https://www.edrdg.org/kanjidic/kanjidic2.html), CC BY-SA 4.0. Vietnamese readings supplied by Minh Chau Pham. They are not ordered by frequency (本: Bổn, Bản) and mix Hán Việt with Nôm readings (強: Cường, …, Gắng), so the UI joins readings into a word (学生 → HỌC SINH would need 生 to have one reading) only when every character has a single reading, and otherwise lists up to three readings per character.
5. **Tatoeba** — https://tatoeba.org/ , CC BY 2.0 FR. Japanese sentences with human Vietnamese translations, linked to JMdict words through `jpn_indices` (the Tanaka Corpus word index), so conjugated forms such as 食べた still attach to 食べる.

### How meanings are aligned

Bunchaway has no readings, so a written form shared by homographs (生 なま/せい/き) would otherwise lend one meaning to every entry. Each form gives its Vietnamese meaning to a single owner entry: common entries first, then entries where the form is the primary spelling. Entries with kanji only use kanji spellings, because Bunchaway's kana headwords are too ambiguous (げ is the kana itself, not 気). Entries without an owned meaning are left out of the published dictionary. With JMdict 3.6.2 this drops about 4,100 entries, 175 of them among the 22,650 common entries (mostly secondary readings such as 空 そら or 生 せい).

Wiktionary definitions are matched by reading as well as spelling. A kana page holds one record per word with its kanji spelling (はし: 橋, 箸, 端), so a record is used only by entries with that spelling. Kanji pages that only point at a kana page (食べる → たべる) are followed. Single-kanji pages mix readings and tag senses with the reading they belong to (気: （キ）…), so only senses tagged with one of the entry's readings are used, and untagged senses on those pages are skipped. Records that name no spelling go to the entry that owns the form under the Bunchaway rule above, and only for words usually written in kana. Cross-reference lines such as 「コンピュータ」を参照 are dropped.

### Japanese data layout

Lookup keys are NFKC-normalised, lower-cased and katakana-folded to hiragana, so タベル, ｺﾝﾋﾟｭｰﾀｰ and たべる share keys. Each key page lists up to 40 entries, common entries first. Pages are spread over 256 shards by FNV-1a hash (`/dictionary/data/ja-<version>/<hex>.json`, about 0.5 MB each); the index (display forms sorted in JavaScript UTF-16 order, ~8.7 MB / ~2 MB gzip) and Hán Việt map (`kanji.json`) load only when the Japanese mode is opened. The normalisation and hash are implemented twice, in `scripts/build_japanese.py` and `src/utils/japanese.ts`; `tests/japanese.test.mjs` checks they agree. The last local build produced **238,465 entries / 471,770 keys / 6,115 examples**.

### Offline

The app shell is precached separately from the data shards. The English and Japanese dictionaries are downloaded for offline use separately; the Japanese download includes its index, Hán Việt map and shards. Data chunks are partitioned into 2-character prefixes to avoid huge single downloads on iPhone. A complete download is pinned, so it keeps working after a new data version is deployed until the user updates it, and files of unused versions are deleted. Storage quotas, eviction, and caching differ between browsers, so an offline download is best-effort, not a promise of permanent storage. The Service Worker runtime cache and offline download code both use `lexi-dictionary-v2`.

### Responsible quality improvements

- Sample-check everyday words, multiple-meaning verbs (run, take, get), idioms and phrasal verbs.
- Report machine-generated examples that are unnatural or inconsistent with the meaning.
- Do not conflate the English and Vietnamese ordering of senses.
- Prefer source metadata instead of inventing sense alignments or translations.
- Filter nonsense entries without deleting valid specialized terms blindly.
