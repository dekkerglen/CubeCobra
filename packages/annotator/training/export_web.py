#!/usr/bin/env python3
"""Export the trained YOLO-OBB model for in-browser (onnxruntime-web) inference.

Exports best.pt -> ONNX and copies it into the app's static assets so Vite serves
it at /models/namebar.onnx, alongside a small meta.json the viewer reads.

    python training/export_web.py                 # newest runs/*/weights/best.pt
    python training/export_web.py --weights path/to/best.pt --imgsz 1024
"""
import argparse
import json
import shutil
from pathlib import Path

from ultralytics import YOLO

ROOT = Path(__file__).resolve().parent.parent
# The annotator's own static dir (its Predict mode) and CubeCobra's static dir.
# CubeCobra serves packages/server/public from disk in dev and syncs it to
# S3/CloudFront in prod, so dropping the model here gets it onto the CDN.
MODELS_DIRS = [ROOT / "public" / "models", ROOT.parent / "server" / "public" / "models"]


def newest_weights():
    cands = sorted((ROOT / "data" / "yolo" / "runs").glob("**/weights/best.pt"), key=lambda p: p.stat().st_mtime)
    return cands[-1] if cands else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--weights", default=None)
    ap.add_argument("--imgsz", type=int, default=1024)
    args = ap.parse_args()

    weights = Path(args.weights) if args.weights else newest_weights()
    if not weights or not weights.exists():
        raise SystemExit("no best.pt found — train first (training/train.py)")

    print(f"exporting {weights} (imgsz {args.imgsz}) …")
    onnx_path = Path(YOLO(str(weights)).export(format="onnx", imgsz=args.imgsz, opset=20, simplify=True))
    meta = json.dumps({"imgsz": args.imgsz, "names": {"0": "namebar"}}, indent=2)

    for models_dir in MODELS_DIRS:
        models_dir.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(onnx_path, models_dir / "namebar.onnx")
        (models_dir / "namebar.json").write_text(meta)
        print(f"copied -> {models_dir / 'namebar.onnx'}")


if __name__ == "__main__":
    main()
