#!/usr/bin/env python3
"""Build Lexi bilingual dictionary from open, attributed sources.

The public build combines Skypedia (CC BY-SA), Vietnamese Wiktionary
(CC BY-SA / GFDL), Simple English Wiktionary (CC BY-SA) and Open English
WordNet (CC BY + Princeton). The full English Wiktionary raw extraction can
be substituted using LEXI_EN_WIKTIONARY_SOURCE but is much larger.
The Japanese–Vietnamese section is built by build_japanese.py.
"""
from __future__ import annotations

import gzip
import hashlib
import json
import os
import shutil
import sqlite3
import tempfile
import unicodedata
import urllib.request
import xml.etree.ElementTree as ET
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "public" / "dictionary"
SKYPEDIA_URL = os.getenv("LEXI_SKYPEDIA_SOURCE", "https://raw.githubusercontent.com/skypediacode/english-vietnamese-dictionary/main/dictionary_en_vi.db")
VI_URL = os.getenv("LEXI_VI_SOURCE", "https://kaikki.org/viwiktionary/raw-wiktextract-data.jsonl.gz")
WIKI_EN_URL = os.getenv("LEXI_EN_WIKTIONARY_SOURCE", "https://kaikki.org/simplewiktionary/raw-wiktextract-data.jsonl.gz")
WORDNET_URL = os.getenv("LEXI_EN_SOURCE", "https://en-word.net/static/english-wordnet-2025.xml.gz")
MAX_SENSES_PER_LANGUAGE = 64
ALPHABET = "abcdefghijklmnopqrstuvwxyz"
SOURCES = [
    {"id": "skypedia", "name": "Skypedia English–Vietnamese Dictionary (derived from MinhQND)", "url": "https://github.com/skypediacode/english-vietnamese-dictionary", "license": "CC BY-SA 4.0"},
    {"id": "viwiktionary", "name": "Vietnamese Wiktionary via Kaikki", "url": "https://vi.wiktionary.org/", "license": "CC BY-SA / GFDL"},
    {"id": "enwiktionary", "name": "Simple English Wiktionary via Kaikki (raw Wiktextract)", "url": "https://simple.wiktionary.org/", "license": "CC BY-SA / GFDL"},
    {"id": "wordnet", "name": "Open English WordNet 2025", "url": "https://en-word.net/", "license": "CC BY 4.0 and Princeton WordNet license"}
]

def normalize(word: str) -> str:
    return " ".join(unicodedata.normalize("NFKC", word).lower().split())

def acceptable(word: str) -> bool:
    return bool(word) and len(word) <= 80 and len(word.split()) <= 7 and (
        any("a" <= ch <= "z" for ch in word)
    ) and not any(ord(ch) < 32 for ch in word)

def get_entry(data: dict, word: str) -> dict | None:
    key = normalize(word)
    if not acceptable(key):
        return None
    return data.setdefault(key, {"headword": word.strip(), "en": [], "vi": []})

def download(url: str, dest: Path) -> str:
    print(f"Downloading {url}", flush=True)
    digest = hashlib.sha256()
    request = urllib.request.Request(url, headers={"User-Agent": "LexiDictionary/0.3 (nonprofit; https://github.com/sonmai/lexi)"})
    with urllib.request.urlopen(request, timeout=180) as response, dest.open("wb") as output:
        while chunk := response.read(1024 * 1024):
            output.write(chunk)
            digest.update(chunk)
    print(f"  Downloaded {dest.stat().st_size / 1e6:.1f} MB", flush=True)
    return digest.hexdigest()

def sense_append(entry: dict, lang: str, pos: str, definition: str, source: str, example: str | None = None, tags: list[str] | None = None) -> None:
    definition = " ".join((definition or "").split())
    if not definition or len(definition) > 1800:
        return
    collection = entry[lang]
    if len(collection) >= MAX_SENSES_PER_LANGUAGE:
        return
    key = normalize(definition)
    if any(normalize(existing["definition"]) == key for existing in collection):
        return
    sense = {"partOfSpeech": pos or "other", "definition": definition, "source": source}
    if example and len(example) < 750:
        sense["example"] = " ".join(example.split())
    if tags:
        sense["tags"] = tags[:5]
    collection.append(sense)

def load_skypedia(path: Path, data: dict) -> int:
    """Skypedia schema is documented in upstream schema.sql."""
    count = 0
    with sqlite3.connect(f"file:{path}?mode=ro", uri=True) as conn:
        for word, definition, pos, subpos, example in conn.execute("""
            SELECT w.word, d.definition, d.pos, d.sub_pos, wd.example
            FROM words w
            JOIN word_definitions wd ON wd.word_id = w.id
            JOIN definitions d ON d.id = wd.definition_id
            WHERE d.definition_lang = 'vi' OR d.definition_lang IS NULL
            ORDER BY w.word, wd.id
        """):
            entry = get_entry(data, word)
            if not entry:
                continue
            label = (pos or "other").strip()
            if subpos and subpos != pos:
                label += f" · {subpos}"
            sense_append(entry, "vi", label, definition, "skypedia", example=example)
            count += 1
        for word, ipa, region in conn.execute("""
            SELECT w.word, p.ipa, p.region
            FROM words w JOIN pronunciations p ON p.word_id = w.id
        """):
            entry = get_entry(data, word)
            if not entry or not ipa or len(ipa) >= 90:
                continue
            region = (region or "").lower()
            if region in ("uk", "bre", "br", "gb", "en-gb") and not entry.get("ipaUk"):
                entry["ipaUk"] = ipa
            elif region in ("us", "name", "am", "en-us") and not entry.get("ipaUs"):
                entry["ipaUs"] = ipa
            elif not entry.get("ipa"):
                entry["ipa"] = ipa
    print(f"Skypedia links processed: {count:,}", flush=True)
    return count

def from_wiktionary(path: Path, data: dict, lang: str, source_name: str) -> int:
    count = 0
    with gzip.open(path, "rt", encoding="utf-8", errors="replace") as stream:
        for line in stream:
            if not line.strip():
                continue
            item = json.loads(line)
            if item.get("lang_code") != "en":
                continue
            entry = get_entry(data, item.get("word", ""))
            if entry is None:
                continue
            pos = item.get("pos") or "other"
            for sense in item.get("senses") or []:
                glosses = sense.get("glosses") or sense.get("raw_glosses") or []
                examples = sense.get("examples") or []
                example = next((e.get("text") for e in examples if isinstance(e, dict) and isinstance(e.get("text"), str)), None)
                tags = [tag for tag in (sense.get("tags") or []) if isinstance(tag, str)]
                # Use one (most specific) gloss per sense instead of duplicating nested senses.
                for gloss in glosses[-1:]:
                    if isinstance(gloss, str):
                        sense_append(entry, lang, pos, gloss, source_name, example=example, tags=tags)
            for sound in item.get("sounds") or []:
                ipa = sound.get("ipa")
                if not isinstance(ipa, str) or not 1 < len(ipa) < 90:
                    continue
                tags = set(sound.get("tags") or [])
                if tags.intersection({"UK", "Received-Pronunciation", "British"}) and not entry.get("ipaUk"):
                    entry["ipaUk"] = ipa
                elif tags.intersection({"US", "General-American", "American"}) and not entry.get("ipaUs"):
                    entry["ipaUs"] = ipa
                elif not entry.get("ipa"):
                    entry["ipa"] = ipa
            count += 1
    print(f"{source_name}: {count:,} English records", flush=True)
    return count

def tag_name(element: ET.Element) -> str:
    return element.tag.rsplit("}", 1)[-1]

def children(element: ET.Element, name: str):
    for child in element:
        if tag_name(child) == name:
            yield child

def load_wordnet(path: Path, data: dict) -> int:
    synsets: dict[str, tuple[str, str]] = {}
    entries: list[tuple[str, str, str]] = []
    with gzip.open(path, "rb") as stream:
        for _, element in ET.iterparse(stream, events=("end",)):
            tag = tag_name(element)
            if tag == "LexicalEntry":
                for lemma in children(element, "Lemma"):
                    word = lemma.get("writtenForm") or ""
                    if not acceptable(normalize(word)):
                        continue
                    pos = lemma.get("partOfSpeech") or "other"
                    for sense in children(element, "Sense"):
                        if sense.get("synset"):
                            entries.append((word, pos, sense.get("synset")))
                element.clear()
            elif tag == "Synset":
                definition = next((" ".join("".join(el.itertext()).split()) for el in children(element, "Definition")), "")
                example = next((" ".join("".join(el.itertext()).split()) for el in children(element, "Example")), "")
                if definition:
                    synsets[element.get("id", "")] = (definition, example)
                element.clear()
    parts = {"n": "noun", "v": "verb", "a": "adjective", "s": "adjective", "r": "adverb"}
    count = 0
    for word, pos, identifier in entries:
        pair = synsets.get(identifier)
        if pair:
            entry = get_entry(data, word)
            if entry:
                sense_append(entry, "en", parts.get(pos, pos), pair[0], "wordnet", example=pair[1])
                count += 1
    print(f"Open English WordNet senses processed: {count:,}", flush=True)
    return count

def shard_key(word: str) -> str:
    if not word or word[0] not in ALPHABET:
        return "other"
    if len(word) > 1 and word[1] in ALPHABET:
        return word[:2]
    return word[0] + "_"

def save_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

def main():
    if os.getenv("LEXI_SKIP_IMPORT") == "1":
        print("Skip upstream import; demo data available locally", flush=True)
        return
    import build_japanese

    with tempfile.TemporaryDirectory(prefix="lexi-data-") as temp:
        tmp = Path(temp)
        files = [
            (SKYPEDIA_URL, tmp / "skypedia.db"),
            (VI_URL, tmp / "vi.jsonl.gz"),
            (WIKI_EN_URL, tmp / "en-wiki.jsonl.gz"),
            (WORDNET_URL, tmp / "wordnet.xml.gz")
        ]
        hashes = [download(url, path) for url, path in files]
        version = hashlib.sha256(("".join(hashes) + ":lexi-v3").encode()).hexdigest()[:12]
        data: dict[str, dict] = {}
        # Prioritize editorially enriched dictionary senses. Wikipedia/Wiktionary
        # senses are appended if not identical; English Wiktionary precedes WordNet.
        load_skypedia(tmp / "skypedia.db", data)
        from_wiktionary(tmp / "vi.jsonl.gz", data, "vi", "viwiktionary")
        from_wiktionary(tmp / "en-wiki.jsonl.gz", data, "en", "enwiktionary")
        load_wordnet(tmp / "wordnet.xml.gz", data)
        japanese_files, japanese_hashes = build_japanese.download_japanese(tmp)

        data = {word: entry for word, entry in data.items() if entry["en"] or entry["vi"]}
        write_english(data, version)
        del data
        japanese = build_japanese.write_japanese(japanese_files, japanese_hashes)
    manifest_path = TARGET / "manifest.json"
    manifest = json.loads(manifest_path.read_text("utf-8"))
    manifest["japanese"] = japanese
    save_json(manifest_path, manifest)

def write_english(data: dict, version: str) -> None:
    if len(data) < 100_000 and os.getenv("LEXI_ALLOW_SMALL_DATASET") != "1":
        raise RuntimeError(f"Unexpectedly few headwords: {len(data):,}")

    shards: dict[str, dict] = defaultdict(dict)
    for key, entry in data.items():
        shards[shard_key(key)][key] = entry
    base = f"/dictionary/data/{version}"
    chunks = sorted(shards)
    if TARGET.exists():
        shutil.rmtree(TARGET)
    save_json(TARGET / "data" / version / "index.json", sorted(data))
    asset_paths = []
    for part in chunks:
        path = TARGET / "data" / version / (part + ".json")
        save_json(path, shards[part])
        if path.stat().st_size > 20_000_000:
            raise RuntimeError(f"Chunk too large for static hosting: {part} ({path.stat().st_size} B)")
        asset_paths.append(base + "/" + part + ".json")
    save_json(TARGET / "manifest.json", {
        "version": version, "count": len(data), "index": base + "/index.json",
        "chunks": asset_paths, "chunkStrategy": "prefix2", "sources": SOURCES
    })
    examples_vi = sum(1 for e in data.values() for s in e["vi"] if s.get("example"))
    examples_en = sum(1 for e in data.values() for s in e["en"] if s.get("example"))
    print(f"Produced {len(data):,} headwords, {len(chunks)} shards, {examples_vi:,} VI examples and {examples_en:,} EN examples. Version {version}", flush=True)

if __name__ == "__main__":
    main()
