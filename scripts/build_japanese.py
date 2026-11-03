#!/usr/bin/env python3
"""Build Lexi's Japanese–Vietnamese dictionary from open, attributed sources.

JMdict (CC BY-SA 4.0) supplies the entry structure, readings, parts of speech
and English glosses. Bunchaway (CC BY-SA 4.0) supplies Vietnamese meanings,
keyed by written form. KANJIDIC2 (CC BY-SA 4.0) supplies Sino-Vietnamese
(Hán Việt) readings, and Tatoeba (CC BY 2.0 FR) supplies Japanese sentences
with human Vietnamese translations, linked to words through its jpn_indices.

Run directly to rebuild only the Japanese section of an existing build.
"""
from __future__ import annotations

import bz2
import csv
import hashlib
import json
import os
import re
import shutil
import sys
import tarfile
import tempfile
import unicodedata
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_dictionary import TARGET, download, save_json  # noqa: E402

JMDICT_RELEASE = os.getenv("LEXI_JMDICT_RELEASE", "3.6.2+20261102210542")
JMDICT_BASE = f"https://github.com/scriptin/jmdict-simplified/releases/download/{JMDICT_RELEASE}"
JMDICT_URL = os.getenv("LEXI_JMDICT_SOURCE", f"{JMDICT_BASE}/jmdict-eng-{JMDICT_RELEASE}.json.tgz")
KANJIDIC_URL = os.getenv("LEXI_KANJIDIC_SOURCE", f"{JMDICT_BASE}/kanjidic2-all-{JMDICT_RELEASE}.json.tgz")
BUNCHAWAY_URL = os.getenv("LEXI_BUNCHAWAY_SOURCE", "https://raw.githubusercontent.com/bunchaway/tu-dien-nhat-viet/main/final.csv")
TATOEBA_BASE = "https://downloads.tatoeba.org/exports"
TATOEBA_INDICES_URL = os.getenv("LEXI_TATOEBA_INDICES_SOURCE", f"{TATOEBA_BASE}/jpn_indices.tar.bz2")
TATOEBA_JPN_URL = os.getenv("LEXI_TATOEBA_JPN_SOURCE", f"{TATOEBA_BASE}/per_language/jpn/jpn_sentences.tsv.bz2")
TATOEBA_VIE_URL = os.getenv("LEXI_TATOEBA_VIE_SOURCE", f"{TATOEBA_BASE}/per_language/vie/vie_sentences.tsv.bz2")
TATOEBA_LINKS_URL = os.getenv("LEXI_TATOEBA_LINKS_SOURCE", f"{TATOEBA_BASE}/per_language/jpn/jpn-vie_links.tsv.bz2")

SHARD_COUNT = 256
MAX_ENTRIES_PER_KEY = 40
MAX_EXAMPLES_PER_ENTRY = 3
HIDDEN_FORM_TAGS = {"sK", "sk"}
SOURCES = [
    {"id": "jmdict", "name": "JMdict via jmdict-simplified (EDRDG)", "url": "https://www.edrdg.org/jmdict/j_jmdict.html", "license": "CC BY-SA 4.0"},
    {"id": "bunchaway", "name": "Bunchaway Japanese–Vietnamese Dictionary", "url": "https://github.com/bunchaway/tu-dien-nhat-viet", "license": "CC BY-SA 4.0"},
    {"id": "kanjidic", "name": "KANJIDIC2 (EDRDG), Vietnamese readings by Minh Chau Pham", "url": "https://www.edrdg.org/kanjidic/kanjidic2.html", "license": "CC BY-SA 4.0"},
    {"id": "tatoeba", "name": "Tatoeba sentences and jpn_indices", "url": "https://tatoeba.org/", "license": "CC BY 2.0 FR"},
]


def normalize(text: str) -> str:
    """Lookup key shared with src/utils/japanese.ts: NFKC, lower case, katakana as hiragana."""
    text = unicodedata.normalize("NFKC", text).lower()
    text = "".join(chr(ord(ch) - 0x60) if "\u30a1" <= ch <= "\u30f6" else ch for ch in text)
    return " ".join(text.split())


def shard_of(key: str) -> str:
    """FNV-1a over code points; mirrored in src/utils/japanese.ts."""
    value = 0x811C9DC5
    for ch in key:
        value ^= ord(ch)
        value = (value * 0x01000193) & 0xFFFFFFFF
    return f"{value % SHARD_COUNT:02x}"


def js_order(text: str) -> bytes:
    """Sort key matching JavaScript's UTF-16 string comparison."""
    return normalize(text).encode("utf-16-be")


def has_kanji(text: str) -> bool:
    return any("\u3400" <= ch <= "\u9fff" or "\uf900" <= ch <= "\ufaff" or ord(ch) >= 0x20000 for ch in text)


def read_tgz_json(path: Path) -> dict:
    with tarfile.open(path, "r:gz") as archive:
        member = next(m for m in archive.getmembers() if m.name.endswith(".json"))
        return json.load(archive.extractfile(member))


def split_vietnamese(definition: str) -> list[str]:
    meanings = []
    for line in definition.splitlines():
        line = re.sub(r"^\s*\d+\s*[.)]\s*", "", line).strip()
        if line and line not in meanings:
            meanings.append(line)
    return meanings


def load_bunchaway(path: Path) -> dict[str, list[str]]:
    result = {}
    with path.open(encoding="utf-8", newline="") as stream:
        for row in csv.reader(stream):
            if len(row) >= 2 and row[0].strip():
                meanings = split_vietnamese(row[1])
                if meanings:
                    result[row[0].strip()] = meanings
    print(f"Bunchaway headwords: {len(result):,}", flush=True)
    return result


def load_hanviet(path: Path) -> dict[str, list[str]]:
    result = {}
    for character in read_tgz_json(path)["characters"]:
        readings = [
            reading["value"]
            for group in (character.get("readingMeaning") or {}).get("groups", [])
            for reading in group["readings"] if reading["type"] == "vietnam"
        ]
        if readings:
            result[character["literal"]] = list(dict.fromkeys(readings))
    print(f"KANJIDIC2 characters with Hán Việt: {len(result):,}", flush=True)
    return result


def build_entries(jmdict: dict, bunchaway: dict[str, list[str]]) -> list[dict]:
    words = jmdict["words"]
    # Bunchaway is keyed by written form without a reading, so a form shared by
    # homographs (生 なま/せい/き) gives its meaning only to one owner entry:
    # common entries first, then entries where the form is the primary spelling.
    owner: dict[str, tuple[bool, bool, int]] = {}
    for position, word in enumerate(words):
        primary = (word["kanji"] or word["kana"])[0]["text"]
        common = any(k["common"] for k in word["kanji"] + word["kana"])
        for form in {f["text"] for f in word["kanji"] + word["kana"]}:
            rank = (not common, form != primary, position)
            if form not in owner or rank < owner[form]:
                owner[form] = rank

    entries = []
    covered_forms = set()
    for position, word in enumerate(words):
        kanji = [k["text"] for k in word["kanji"] if not HIDDEN_FORM_TAGS & set(k["tags"])]
        kana = [k["text"] for k in word["kana"] if not HIDDEN_FORM_TAGS & set(k["tags"])]
        all_forms = [k["text"] for k in word["kanji"]] + [k["text"] for k in word["kana"]]
        covered_forms.update(all_forms)
        # Kana spellings of kanji words are too ambiguous in Bunchaway (げ is the kana itself, not 気).
        written = [k["text"] for k in word["kanji"]]
        by_priority = kanji + [form for form in written if form not in kanji] if written else all_forms
        vi_form = next((form for form in by_priority if form in bunchaway and owner[form][2] == position), None)
        entry = {
            "id": word["id"],
            "forms": kanji,
            "readings": kana or [k["text"] for k in word["kana"]],
            "vi": bunchaway[vi_form] if vi_form else [],
            "en": [],
        }
        if any(k["common"] for k in word["kanji"] + word["kana"]):
            entry["common"] = True
        for sense in word["sense"]:
            glosses = [g["text"] for g in sense["gloss"] if g["lang"] == "eng"]
            if not glosses:
                continue
            item = {"pos": sense["partOfSpeech"], "gloss": "; ".join(glosses)}
            if sense["misc"]:
                item["tags"] = sense["misc"][:4]
            entry["en"].append(item)
        entries.append((entry, all_forms))

    extra = 0
    for head, meanings in bunchaway.items():
        if head in covered_forms:
            continue
        entry = {"id": f"b{extra}", "forms": [head] if has_kanji(head) else [], "readings": [] if has_kanji(head) else [head], "vi": meanings, "en": []}
        entries.append((entry, [head]))
        extra += 1
    print(f"Japanese entries: {len(entries):,} ({extra:,} Bunchaway-only)", flush=True)
    return entries


def parse_index_token(token: str) -> tuple[str, str | None, bool] | None:
    match = re.match(r"^([^(\[{~|]+)(?:\|\d+)?(?:\(([^)]+)\))?(?:\[\d+\])?(?:\{[^}]*\})?(~)?$", token)
    if not match:
        return None
    return match.group(1), match.group(2), bool(match.group(3))


def read_tsv_bz2(path: Path):
    with bz2.open(path, "rt", encoding="utf-8", errors="replace") as stream:
        for line in stream:
            yield line.rstrip("\n").split("\t")


def attach_examples(entries: list[tuple[dict, list[str]]], files: dict[str, Path]) -> int:
    links: dict[str, str] = {}
    for row in read_tsv_bz2(files["links"]):
        if len(row) >= 2:
            links.setdefault(row[0], row[1])
    wanted_vie = set(links.values())
    vietnamese = {row[0]: row[2] for row in read_tsv_bz2(files["vie"]) if len(row) >= 3 and row[0] in wanted_vie}
    japanese = {row[0]: row[2] for row in read_tsv_bz2(files["jpn"]) if len(row) >= 3 and row[0] in links}

    by_form: dict[str, list[dict]] = defaultdict(list)
    for entry, forms in entries:
        for form in dict.fromkeys(forms):
            by_form[form].append(entry)

    candidates: dict[str, list[tuple[bool, int, dict]]] = defaultdict(list)
    with tarfile.open(files["indices"], "r:bz2") as archive:
        member = next(m for m in archive.getmembers() if m.name.endswith(".csv"))
        for raw in archive.extractfile(member):
            row = raw.decode("utf-8", errors="replace").rstrip("\n").split("\t")
            if len(row) < 3 or row[0] not in japanese or links[row[0]] not in vietnamese:
                continue
            example = {"ja": japanese[row[0]], "vi": vietnamese[links[row[0]]]}
            for token in row[2].split():
                parsed = parse_index_token(token)
                if not parsed:
                    continue
                head, reading, checked = parsed
                matches = [e for e in by_form.get(head, []) if not reading or reading in e["readings"]]
                if len(matches) == 1:
                    candidates[matches[0]["id"]].append((not checked, len(example["ja"]), example))

    attached = 0
    by_id = {entry["id"]: entry for entry, _ in entries}
    for identifier, options in candidates.items():
        chosen = []
        for _, _, example in sorted(options, key=lambda option: option[:2]):
            if example not in chosen:
                chosen.append(example)
            if len(chosen) == MAX_EXAMPLES_PER_ENTRY:
                break
        by_id[identifier]["examples"] = chosen
        attached += len(chosen)
    print(f"Tatoeba examples attached: {attached:,} across {len(candidates):,} entries", flush=True)
    return attached


def build_pages(entries: list[tuple[dict, list[str]]]) -> tuple[dict[str, list[dict]], dict[str, str]]:
    pages: dict[str, list[dict]] = defaultdict(list)
    # Suggestions show the written form; search-only spellings are used only as a fallback.
    display: dict[str, tuple[bool, str]] = {}
    for entry, forms in entries:
        if not entry["vi"] and not entry["en"]:
            continue
        visible = set(entry["forms"] + entry["readings"])
        for form in dict.fromkeys(forms):
            key = normalize(form)
            if not key or len(key) > 60:
                continue
            if not pages[key] or pages[key][-1] is not entry:
                pages[key].append(entry)
            candidate = (form not in visible, form)
            if key not in display or candidate[0] < display[key][0]:
                display[key] = candidate

    def rank(key: str, entry: dict) -> tuple:
        primary = (entry["forms"] or entry["readings"] or [""])[0]
        return (not entry.get("common"), normalize(primary) != key, not entry["vi"])

    for key, items in pages.items():
        items.sort(key=lambda entry: rank(key, entry))
        del items[MAX_ENTRIES_PER_KEY:]
    return pages, {key: form for key, (_, form) in display.items()}


def write_japanese(files: dict[str, Path], hashes: list[str]) -> dict:
    version = hashlib.sha256(("".join(hashes) + ":lexi-ja-v1").encode()).hexdigest()[:12]
    bunchaway = load_bunchaway(files["bunchaway"])
    jmdict = read_tgz_json(files["jmdict"])
    entries = build_entries(jmdict, bunchaway)
    del jmdict, bunchaway
    examples = attach_examples(entries, files)
    pages, display = build_pages(entries)
    hanviet = load_hanviet(files["kanjidic"])
    used = {ch for entry, _ in entries for form in entry["forms"] for ch in form}
    hanviet = {ch: readings for ch, readings in sorted(hanviet.items()) if ch in used}

    folder = f"ja-{version}"
    for old in (TARGET / "data").glob("ja-*"):
        shutil.rmtree(old)
    base = f"/dictionary/data/{folder}"
    shards: dict[str, dict] = defaultdict(dict)
    for key, items in pages.items():
        shards[shard_of(key)][key] = items
    chunks = []
    for part in sorted(shards):
        path = TARGET / "data" / folder / f"{part}.json"
        save_json(path, shards[part])
        if path.stat().st_size > 20_000_000:
            raise RuntimeError(f"Japanese chunk too large for static hosting: {part} ({path.stat().st_size} B)")
        chunks.append(f"{base}/{part}.json")
    save_json(TARGET / "data" / folder / "index.json", sorted((display[key] for key in pages), key=js_order))
    save_json(TARGET / "data" / folder / "kanji.json", hanviet)
    entry_count = len({entry["id"] for items in pages.values() for entry in items})
    with_vi = len({entry["id"] for items in pages.values() for entry in items if entry["vi"]})
    print(f"Produced {entry_count:,} Japanese entries ({with_vi:,} with Vietnamese), {len(pages):,} lookup keys, {len(chunks)} shards, {examples:,} examples. Version {version}", flush=True)
    return {
        "version": version, "count": entry_count, "keys": len(pages),
        "index": f"{base}/index.json", "kanji": f"{base}/kanji.json",
        "chunks": chunks, "chunkStrategy": "fnv1a", "shardCount": SHARD_COUNT,
        "sources": SOURCES,
    }


def download_japanese(tmp: Path) -> tuple[dict[str, Path], list[str]]:
    files = {
        "jmdict": (JMDICT_URL, tmp / "jmdict.json.tgz"),
        "kanjidic": (KANJIDIC_URL, tmp / "kanjidic2.json.tgz"),
        "bunchaway": (BUNCHAWAY_URL, tmp / "bunchaway.csv"),
        "indices": (TATOEBA_INDICES_URL, tmp / "jpn_indices.tar.bz2"),
        "jpn": (TATOEBA_JPN_URL, tmp / "jpn_sentences.tsv.bz2"),
        "vie": (TATOEBA_VIE_URL, tmp / "vie_sentences.tsv.bz2"),
        "links": (TATOEBA_LINKS_URL, tmp / "jpn-vie_links.tsv.bz2"),
    }
    hashes = [download(url, path) for url, path in files.values()]
    return {name: path for name, (_, path) in files.items()}, hashes


def main():
    with tempfile.TemporaryDirectory(prefix="lexi-ja-") as temp:
        files, hashes = download_japanese(Path(temp))
        section = write_japanese(files, hashes)
    manifest_path = TARGET / "manifest.json"
    manifest = json.loads(manifest_path.read_text("utf-8")) if manifest_path.exists() else {
        "version": "demo", "count": 0, "index": None, "chunks": [], "chunkStrategy": "prefix2", "sources": []
    }
    manifest["japanese"] = section
    save_json(manifest_path, manifest)


if __name__ == "__main__":
    main()
