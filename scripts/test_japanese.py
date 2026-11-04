#!/usr/bin/env python3
"""Sanity checks on the generated Japanese–Vietnamese dictionary, CI-safe and stdlib only."""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_japanese import js_order, normalize, shard_of  # noqa: E402

ROOT = Path(__file__).resolve().parents[1] / "public" / "dictionary"


def read(url: str):
    return json.loads((ROOT / url.removeprefix("/dictionary/")).read_text("utf-8"))


japanese = json.loads((ROOT / "manifest.json").read_text("utf-8"))["japanese"]
assert japanese["chunkStrategy"] == "fnv1a", japanese["chunkStrategy"]
assert japanese["count"] >= 200_000, japanese["count"]
assert len(japanese["chunks"]) == japanese["shardCount"], len(japanese["chunks"])
assert {"jmdict", "bunchaway", "jawiktionary", "kanjidic", "tatoeba"} <= {s["id"] for s in japanese["sources"]}

words = read(japanese["index"])
keys = [normalize(word) for word in words]
assert len(words) == japanese["keys"], (len(words), japanese["keys"])
assert len(set(keys)) == len(keys), "Index keys must be unique after normalisation"
assert words == sorted(words, key=js_order), "Index must follow JavaScript UTF-16 order"

kanji = read(japanese["kanji"])
assert kanji["食"][0] == "Thực" and kanji["先"][0] == "Tiên", (kanji.get("食"), kanji.get("先"))

entries: dict[str, dict] = {}
pages_seen = 0
for url in japanese["chunks"]:
    file = ROOT / url.removeprefix("/dictionary/")
    assert file.stat().st_size < 20_000_000, file
    chunk = json.loads(file.read_text("utf-8"))
    shard = file.stem
    for key, page in chunk.items():
        assert shard_of(key) == shard, (key, shard)
        assert page, key
        pages_seen += 1
        for entry in page:
            entries[entry["id"]] = entry
assert pages_seen == len(words), (pages_seen, len(words))
assert len(entries) == japanese["count"], (len(entries), japanese["count"])

assert all(e["vi"] for e in entries.values()), "Entries without Vietnamese must be left out"
assert all("en" not in e for e in entries.values()), "English glosses are not shipped"
common = sum(1 for e in entries.values() if e.get("common"))
assert common >= 22_000, common
examples = sum(len(e.get("examples", [])) for e in entries.values())
assert examples >= 3_000, examples
monolingual = sum(1 for e in entries.values() if e.get("common") and e.get("ja"))
assert monolingual >= 18_000, monolingual


def page(word: str) -> list[dict]:
    key = normalize(word)
    return read(f"/dictionary/data/ja-{japanese['version']}/{shard_of(key)}.json")[key]


for word, meaning in [("食べる", "Ăn"), ("先生", "Giáo viên"), ("たべる", "Ăn"), ("コンピューター", "Máy")]:
    first = page(word)[0]
    assert any(meaning in m for m in first["vi"]), (word, first["vi"])
    assert first["pos"], word
assert {"橋", "箸"} <= {e["forms"][0] for e in page("はし") if e["forms"]}
# Homographs must not borrow another reading's Vietnamese meaning: 気 げ has none, so it is left out.
assert not any(e["readings"] == ["げ"] for e in page("気"))


def definitions(word: str, reading: str) -> str:
    entry = next(e for e in page(word) if reading in e["readings"])
    return " ".join(entry.get("ja", []))


# Japanese definitions follow the kanji spelling on kana pages and the reading tag on single-kanji pages.
assert "渡る" in definitions("橋", "はし") and "食器" not in definitions("橋", "はし")
assert "食器" in definitions("箸", "はし") and "渡る" not in definitions("箸", "はし")
assert "気体" in definitions("気", "き") and "（キ）" not in definitions("気", "き")
assert "小生" not in definitions("生", "なま")
assert "飲み込む" in definitions("食べる", "たべる")

print("Verified:", japanese["count"], "Japanese entries;", len(words), "lookup keys;",
      common, "common words;", monolingual, "common words with Japanese definitions;", examples, "Tatoeba examples")
