#!/usr/bin/env python3
"""Train a YOLO-OBB name-bar detector on the exported dataset.

Prereqs:
    pip install -r training/requirements.txt    # ultralytics (pulls torch)
    python training/export_dataset.py            # build data/yolo/

Train:
    python training/train.py                     # yolo11s-obb, imgsz 1024
    python training/train.py --model yolo11n-obb.pt --epochs 50   # quick

Runs/weights land in data/yolo/runs/. Equivalent one-liner:
    yolo obb train model=yolo11s-obb.pt data=data/yolo/dataset.yaml imgsz=1024 epochs=80
"""
import argparse
import os
from pathlib import Path

# Reduce VRAM fragmentation (helps a lot on small laptop GPUs). Must be set
# before torch initializes CUDA, i.e. before importing ultralytics.
os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")

from ultralytics import YOLO

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "yolo" / "dataset.yaml"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="yolo11s-obb.pt", help="base OBB checkpoint")
    ap.add_argument("--imgsz", type=int, default=1024, help="name bars are thin — keep this high")
    ap.add_argument("--epochs", type=int, default=80)
    ap.add_argument("--batch", default=-1, help="-1 = auto (~60%% GPU memory); set explicit on small GPUs")
    ap.add_argument("--device", default=0, help="GPU index, or 'cpu'")
    ap.add_argument("--workers", type=int, default=8, help="dataloader workers — raise to feed a starved GPU")
    ap.add_argument("--mosaic", type=float, default=1.0, help="mosaic aug prob; 0 = off (much faster dataloader)")
    ap.add_argument("--warmup", type=float, default=1.0, help="warmup epochs — keep low for short (few-epoch) runs")
    args = ap.parse_args()

    model = YOLO(args.model)  # *-obb.pt sets task=obb automatically
    model.train(
        data=str(DATA),
        imgsz=args.imgsz,
        epochs=args.epochs,
        batch=int(args.batch) if str(args.batch).lstrip("-").isdigit() else args.batch,
        device=args.device,
        workers=args.workers,
        warmup_epochs=args.warmup,
        project=str(ROOT / "data" / "yolo" / "runs"),
        name="namebar",
        # The generator already randomizes orientation/perspective/lighting, so we
        # keep geometric aug light; mosaic is the dataloader bottleneck on big runs.
        mosaic=args.mosaic,
        degrees=10.0,
        translate=0.05,
        scale=0.3,
        fliplr=0.5,
    )


if __name__ == "__main__":
    main()
