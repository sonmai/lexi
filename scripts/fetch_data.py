#!/usr/bin/env python3
"""Install the dictionary data pinned in data.lock.json into public/dictionary (npm prebuild).

The archive is downloaded once into .cache/lexi-data and verified by SHA-256.
Without a lock file this falls back to building from upstream (build_dictionary.py).
LEXI_SKIP_IMPORT=1 skips the data entirely, leaving the bundled demo entries.
"""
from __future__ import annotations

import json
import os
import shutil
import sys
import tarfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_dictionary  # noqa: E402
from build_dictionary import ROOT, TARGET, download  # noqa: E402
from package_data import LOCK, sha256  # noqa: E402

CACHE = ROOT / ".cache" / "lexi-data"
INSTALLED = CACHE / "installed"


def main() -> None:
    if os.getenv("LEXI_SKIP_IMPORT") == "1":
        print("Skip dictionary data; demo data available locally", flush=True)
        return
    if not LOCK.exists():
        print("No data.lock.json; building dictionary data from upstream sources", flush=True)
        build_dictionary.main()
        return

    lock = json.loads(LOCK.read_text("utf-8"))
    if (TARGET / "manifest.json").exists() and INSTALLED.exists() and INSTALLED.read_text().strip() == lock["sha256"]:
        print(f"Dictionary data {lock['tag']} already installed", flush=True)
        return

    CACHE.mkdir(parents=True, exist_ok=True)
    archive = CACHE / f"{lock['sha256']}.tar.gz"
    if not archive.exists() or sha256(archive) != lock["sha256"]:
        partial = archive.with_suffix(".part")
        digest = download(lock["url"], partial)
        if digest != lock["sha256"]:
            partial.unlink()
            raise RuntimeError(f"Checksum mismatch for {lock['url']}: expected {lock['sha256']}, got {digest}")
        partial.replace(archive)

    INSTALLED.unlink(missing_ok=True)
    if TARGET.exists():
        shutil.rmtree(TARGET)
    with tarfile.open(archive, "r:gz") as tar:
        tar.extractall(TARGET.parent, **({"filter": "data"} if hasattr(tarfile, "data_filter") else {}))
    INSTALLED.write_text(lock["sha256"])
    print(f"Installed dictionary data {lock['tag']}", flush=True)


if __name__ == "__main__":
    main()
