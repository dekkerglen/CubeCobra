#!/usr/bin/env python3
"""Run a trained name-bar detector and save annotated previews.

    python training/predict.py --weights data/yolo/runs/namebar/weights/best.pt \
        --source data/yolo/images/test --conf 0.25

With no --source it predicts on the real test photos. Annotated images land in
data/yolo/runs/predict/.
"""
import argparse
from pathlib import Path

from ultralytics import YOLO

ROOT = Path(__file__).resolve().parent.parent


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--weights", default=str(ROOT / "data" / "yolo" / "runs" / "namebar" / "weights" / "best.pt"))
    ap.add_argument("--source", default=str(ROOT / "data" / "yolo" / "images" / "test"))
    ap.add_argument("--conf", type=float, default=0.25)
    ap.add_argument("--imgsz", type=int, default=1024)
    args = ap.parse_args()

    model = YOLO(args.weights)
    model.predict(
        source=args.source,
        conf=args.conf,
        imgsz=args.imgsz,
        save=True,
        project=str(ROOT / "data" / "yolo" / "runs"),
        name="predict",
        exist_ok=True,
    )
    print(f"annotated previews -> {ROOT / 'data' / 'yolo' / 'runs' / 'predict'}")


if __name__ == "__main__":
    main()
