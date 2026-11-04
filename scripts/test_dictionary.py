#!/usr/bin/env python3
"""Sanity checks on the fully generated dictionary, CI-safe and stdlib only."""
from __future__ import annotations
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "public" / "dictionary"
manifest = json.loads((ROOT / "manifest.json").read_text("utf-8"))
assert manifest["chunkStrategy"] == "prefix2", manifest.get("chunkStrategy")
assert manifest["count"] >= 200_000, manifest["count"]
assert len(manifest["chunks"]) > 300, len(manifest["chunks"])
version = manifest["version"]
assert len(version) == 12
index_path = ROOT.parent / manifest["index"].lstrip("/").replace("dictionary/", "", 1)
# Manifest paths start with /dictionary; ROOT is already that folder.
index_path = ROOT / manifest["index"].removeprefix("/dictionary/")
words = json.loads(index_path.read_text("utf-8"))
assert len(words) == manifest["count"], (len(words), manifest["count"])
assert len(set(words)) == len(words), "Index must be unique"
assert words == sorted(words, key=lambda word: word.encode("utf-16-be")), "Index must follow JavaScript UTF-16 order"
expected = ["example", "run", "apple", "security", "look", "take", "balance"]
assert all(w in words for w in expected), [w for w in expected if w not in words]

vi_examples = 0
en_examples = 0
source_ids = set()
entries_seen = 0
samples = {}
for url in manifest["chunks"]:
    file = ROOT / url.removeprefix("/dictionary/")
    assert file.exists(), file
    assert file.stat().st_size < 20_000_000
    chunk = json.loads(file.read_text("utf-8"))
    entries_seen += len(chunk)
    for word, entry in chunk.items():
        assert word == word.lower(), word
        for sense in entry["vi"]:
            if sense.get("example"):
                vi_examples += 1
            if sense.get("source"):
                source_ids.add(sense["source"])
        for sense in entry["en"]:
            if sense.get("example"):
                en_examples += 1
            if sense.get("source"):
                source_ids.add(sense["source"])
        if word in expected:
            samples[word] = entry
assert entries_seen == manifest["count"], (entries_seen, manifest["count"])
assert vi_examples >= 150_000, vi_examples
assert en_examples >= 50_000, en_examples
assert {"skypedia", "viwiktionary", "enwiktionary", "wordnet"} <= source_ids, source_ids
for word in expected:
    e = samples[word]
    assert e["vi"], f"Missing Vietnamese definition: {word}"
    assert e["en"], f"Missing English definition: {word}"
assert len(samples["run"]["vi"]) >= 3 and len(samples["run"]["en"]) >= 3, "Run lacks multiple meanings"
print("Verified: ", manifest["count"], "headwords;",
      vi_examples, "Vietnamese examples;", en_examples, "English examples")
for word in ("run", "look", "security"):
    entry = samples[word]
    print(word, "VI senses:", len(entry["vi"]), "EN senses:", len(entry["en"]),
          "UK IPA:", bool(entry.get("ipaUk")), "US IPA:", bool(entry.get("ipaUs")))
