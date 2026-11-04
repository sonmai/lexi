#!/usr/bin/env python3
"""Package the generated public/dictionary as a release archive and pin it in data.lock.json.

The data workflow uploads the archive to the GitHub Release named by the tag this
prints. App builds then install exactly that archive (see fetch_data.py), so
deploying the app no longer depends on upstream dictionary sites.
"""
from __future__ import annotations

import gzip
import hashlib
import json
import os
import sys
import tarfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_dictionary import ROOT, TARGET, add_sizes, save_json  # noqa: E402

LOCK = ROOT / "data.lock.json"
OUTPUT = ROOT / ".cache" / "release"
RELEASE_BASE = os.getenv("LEXI_DATA_RELEASE_BASE", "https://github.com/sonmai/lexi/releases/download")


def write_archive(source: Path, dest: Path) -> None:
    """Sorted members and zeroed metadata keep the archive byte-identical for identical data."""
    with dest.open("wb") as raw, gzip.GzipFile(fileobj=raw, mode="wb", mtime=0, filename="") as zipped, \
            tarfile.open(fileobj=zipped, mode="w", format=tarfile.PAX_FORMAT) as tar:
        for path in sorted(p for p in source.rglob("*") if p.is_file()):
            info = tar.gettarinfo(path, arcname=path.relative_to(source.parent).as_posix())
            info.mtime, info.uid, info.gid, info.uname, info.gname, info.mode = 0, 0, 0, "", "", 0o644
            with path.open("rb") as stream:
                tar.addfile(info, stream)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        while chunk := stream.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    manifest_path = TARGET / "manifest.json"
    manifest = json.loads(manifest_path.read_text("utf-8"))
    if not manifest.get("index") or not manifest.get("japanese"):
        raise RuntimeError("Both the English and Japanese sections must be built before packaging")
    save_json(manifest_path, add_sizes(manifest))

    english, japanese = manifest["version"], manifest["japanese"]["version"]
    OUTPUT.mkdir(parents=True, exist_ok=True)
    archive = OUTPUT / f"lexi-dictionary-{english}-{japanese}.tar.gz"
    write_archive(TARGET, archive)
    digest = sha256(archive)
    tag = f"data-{english}-{japanese}-{digest[:8]}"
    previous = json.loads(LOCK.read_text("utf-8")) if LOCK.exists() else {}
    lock = {
        "tag": tag,
        "url": f"{RELEASE_BASE}/{tag}/{archive.name}",
        "sha256": digest,
        "bytes": archive.stat().st_size,
        "english": english,
        "japanese": japanese,
    }
    LOCK.write_text(json.dumps(lock, indent=2) + "\n", encoding="utf-8")
    changed = previous.get("sha256") != digest
    print(f"Packaged {archive.name} ({lock['bytes'] / 1e6:.1f} MB) as {tag}; changed: {changed}", flush=True)
    if output := os.getenv("GITHUB_OUTPUT"):
        with open(output, "a", encoding="utf-8") as stream:
            stream.write(f"tag={tag}\narchive={archive}\nchanged={str(changed).lower()}\n")


if __name__ == "__main__":
    main()
