#!/usr/bin/env python3
"""Build versioned static English↔Vietnamese/English dictionary assets.

Sources: Vietnamese Wiktionary (via Wiktextract/Kaikki) and Open English WordNet.
Requires only the Python 3 standard library. Raw upstream datasets are downloaded
during the build; they are not committed to this repository.
"""
from __future__ import annotations

import gzip
import hashlib
import json
import os
import re
import shutil
import tempfile
import unicodedata
import urllib.request
import xml.etree.ElementTree as ET
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "public" / "dictionary"
VI_URL = os.environ.get("LEXI_VI_SOURCE", "https://kaikki.org/viwiktionary/raw-wiktextract-data.jsonl.gz")
EN_URL = os.environ.get("LEXI_EN_SOURCE", "https://en-word.net/static/english-wordnet-2025.xml.gz")
MAX_SENSES_PER_LANGUAGE = 32
ALPHABET = "abcdefghijklmnopqrstuvwxyz"

def normalize(value: str) -> str:
    return " ".join(unicodedata.normalize("NFKC", value).lower().split())

def acceptable(word: str) -> bool:
    return bool(word) and len(word) <= 80 and len(word.split()) <= 7 and (
        any("a" <= ch <= "z" for ch in word)
    ) and not any(ord(ch) < 32 for ch in word)

def download(url: str, path: Path) -> str:
    print(f"Downloading {url}", flush=True)
    req = urllib.request.Request(url, headers={"User-Agent": "LexiDictionaryBuild/0.2 (+https://github.com/sonmai/english-dictionary-pwa)"})
    digest = hashlib.sha256()
    with urllib.request.urlopen(req, timeout=120) as res, path.open("wb") as out:
        while chunk := res.read(1024 * 1024):
            digest.update(chunk)
            out.write(chunk)
    print(f"  Downloaded {path.stat().st_size / 1e6:.1f} MB", flush=True)
    return digest.hexdigest()

def add_sense(entry: dict, target: str, pos: str, definition: str, example: str | None = None) -> None:
    definition = " ".join((definition or "").split())
    if not definition or len(definition) > 1600:
        return
    senses = entry[target]
    if len(senses) >= MAX_SENSES_PER_LANGUAGE:
        return
    if any(s["partOfSpeech"] == pos and s["definition"] == definition for s in senses):
        return
    record = {"partOfSpeech": pos or "other", "definition": definition}
    if example and len(example) < 600:
        record["example"] = " ".join(example.split())
    senses.append(record)

def entry_for(data: dict, word: str) -> dict | None:
    key = normalize(word)
    if not acceptable(key):
        return None
    if key not in data:
        data[key] = {"headword": word.strip(), "en": [], "vi": []}
    return data[key]

def load_vietnamese(source: Path, data: dict) -> int:
    count = 0
    with gzip.open(source, "rt", encoding="utf-8", errors="replace") as stream:
        for line in stream:
            if not line.strip():
                continue
            row = json.loads(line)
            if row.get("lang_code") != "en":
                continue
            entry = entry_for(data, row.get("word", ""))
            if entry is None:
                continue
            pos = row.get("pos") or "other"
            for sense in row.get("senses") or []:
                glosses = sense.get("glosses") or sense.get("raw_glosses") or []
                for gloss in glosses[:4]:
                    if isinstance(gloss, str):
                        add_sense(entry, "vi", pos, gloss)
            if "ipa" not in entry:
                for sound in row.get("sounds") or []:
                    ipa = sound.get("ipa")
                    if isinstance(ipa, str) and 1 < len(ipa) < 90:
                        entry["ipa"] = ipa
                        break
            count += 1
    print(f"Vietnamese Wiktionary English records: {count:,}", flush=True)
    return count

def local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]

def xml_children(element: ET.Element, tag: str):
    for child in element:
        if local_name(child.tag) == tag:
            yield child

def load_english(source: Path, data: dict) -> int:
    # WN-LMF stores definitions on synsets and lemmas/senses on lexical entries.
    synsets: dict[str, tuple[str, str]] = {}
    lexical: list[tuple[str, str, str]] = []
    with gzip.open(source, "rb") as stream:
        for _, element in ET.iterparse(stream, events=("end",)):
            name = local_name(element.tag)
            if name == "LexicalEntry":
                for lemma in xml_children(element, "Lemma"):
                    word = lemma.get("writtenForm") or ""
                    pos = lemma.get("partOfSpeech") or ""
                    if not acceptable(normalize(word)):
                        continue
                    for sense in xml_children(element, "Sense"):
                        synset = sense.get("synset")
                        if synset:
                            lexical.append((word, pos, synset))
                element.clear()
            elif name == "Synset":
                definition = next((
                    " ".join("".join(child.itertext()).split())
                    for child in xml_children(element, "Definition")
                ), "")
                example = next((
                    " ".join("".join(child.itertext()).split())
                    for child in xml_children(element, "Example")
                ), "")
                if definition:
                    synsets[element.get("id", "")] = (definition, example)
                element.clear()
    parts = {"n": "noun", "v": "verb", "a": "adjective", "s": "adjective", "r": "adverb"}
    merged = 0
    for word, pos, synset_id in lexical:
        detail = synsets.get(synset_id)
        if not detail:
            continue
        entry = entry_for(data, word)
        if entry is None:
            continue
        add_sense(entry, "en", parts.get(pos, pos or "other"), *detail)
        merged += 1
    print(f"Open English WordNet lexical senses mapped: {merged:,}", flush=True)
    return merged

def shard(word: str) -> str:
    initial = word[0]
    return initial if initial in ALPHABET else "other"

def write_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

def main() -> None:
    if os.environ.get("LEXI_SKIP_IMPORT") == "1":
        print("Skipping full dataset import. Prototype fixtures remain available.")
        return

    with tempfile.TemporaryDirectory(prefix="lexi-source-") as tmp:
        tmpdir = Path(tmp)
        vi_file = tmpdir / "vi.jsonl.gz"
        en_file = tmpdir / "en.xml.gz"
        vi_digest = download(VI_URL, vi_file)
        en_digest = download(EN_URL, en_file)
        version = hashlib.sha256((vi_digest + en_digest + ":v2").encode()).hexdigest()[:12]
        data: dict[str, dict] = {}
        load_vietnamese(vi_file, data)
        load_english(en_file, data)

    # Remove entries with no usable definitions. Keep independent sense lists.
    data = {word: record for word, record in data.items() if record["en"] or record["vi"]}
    if len(data) < 100_000 and os.environ.get("LEXI_ALLOW_SMALL_DATASET") != "1":
        raise RuntimeError(f"Unexpectedly small dictionary: {len(data):,} words")

    if TARGET.exists():
        shutil.rmtree(TARGET)
    shards: dict[str, dict] = defaultdict(dict)
    for word, record in data.items():
        shards[shard(word)][word] = record

    base_path = f"/dictionary/data/{version}"
    write_json(TARGET / "data" / version / "index.json", sorted(data))
    chunk_files: list[str] = []
    for letter in ALPHABET + " ":
        key = letter if letter != " " else "other"
        if not shards[key]:
            continue
        relative = f"{base_path}/{key}.json"
        write_json(TARGET / "data" / version / f"{key}.json", shards[key])
        chunk_files.append(relative)

    write_json(TARGET / "manifest.json", {
        "version": version,
        "count": len(data),
        "index": f"{base_path}/index.json",
        "chunks": chunk_files,
        "sources": [
            {"name": "Vietnamese Wiktionary via Kaikki / Wiktextract", "url": "https://vi.wiktionary.org/", "license": "CC BY-SA / GFDL"},
            {"name": "Open English WordNet 2025", "url": "https://en-word.net/", "license": "CC BY 4.0 and Princeton WordNet license"}
        ]
    })
    print(f"Produced {len(data):,} headwords in {len(chunk_files)} chunks, version {version}", flush=True)
    for file in (TARGET / "data" / version).glob("*.json"):
        if file.stat().st_size > 24_000_000:
            raise RuntimeError(f"Shard too large for Pages static asset: {file}")

if __name__ == "__main__":
    main()
