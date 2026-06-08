# Name-bar detector (YOLO-OBB baseline)

Trains an **oriented** bounding-box detector (one class, `namebar`) to find card
name bars in deck photos. Ground truth comes from the annotator: synthetic images
for train/val, the hand-labeled real photos as the test set (so the
synthetic→real gap is always visible).

## Setup

```bash
cd packages/annotator
python3 -m venv .venv && source .venv/bin/activate
pip install -r training/requirements.txt   # ultralytics (+ torch)
```

If the default torch wheel doesn't match your GPU/driver, install the right one
first from https://pytorch.org/get-started/locally/.

The `model:*` npm scripts below run this package's `.venv/bin/python`, so they work
without activating the venv. Pass flags after `--`. Run them from the repo root with
`-w @cubecobra/annotator` (shown), or from `packages/annotator` without it.

## 1. Generate data, then export

```bash
# generate synthetic photos (knobs at the top of scripts/generate-dataset.mjs)
npm run dataset:generate -w @cubecobra/annotator

# convert annotator labels -> YOLO-OBB layout in data/yolo/
npm run model:dataset -w @cubecobra/annotator -- --limit 3000   # start small; drop --limit for all
```

This writes `data/yolo/{images,labels}/{train,val,test}` (images are **symlinked**,
not copied) and `data/yolo/dataset.yaml`. Re-run it any time you add images.

## 2. Train (local GPU)

```bash
# baseline on the 3k subset:
npm run model:train -w @cubecobra/annotator -- --model yolo11n-obb.pt --epochs 30 --batch 4

# full data — big batch, few epochs, mosaic off (see notes):
npm run model:train -w @cubecobra/annotator -- --model yolo11n-obb.pt --epochs 3 --batch 8 --mosaic 0 --workers 8
```

Weights + curves land in `data/yolo/runs/namebar*/`. The val mAP50(OBB) is the
synthetic score; the **number that matters** is performance on the real test set.

## 3. Evaluate on the real photos

```bash
npm run model:predict -w @cubecobra/annotator        # annotated previews of the real photos
# or full metrics on the held-out real test split:
.venv/bin/yolo obb val model=data/yolo/runs/namebar/weights/best.pt data=data/yolo/dataset.yaml split=test
```

## 4. Test in the browser (client-side model)

The detector is meant to run **client-side in the browser**, so the live viewer is
the annotator app's **Predict** mode, which loads the exported model and runs
inference in-browser via onnxruntime-web — no Python server. After training:

```bash
npm run model:export -w @cubecobra/annotator         # ONNX -> public/models/namebar.onnx
npm start -w @cubecobra/annotator                    # open the app, click "Predict ◎"
```

Re-run `model:export` after each training run to refresh the served model (hard-refresh
the browser tab so it re-fetches the `.onnx`).

## Notes / tuning

- **`imgsz` matters most.** Name bars are thin (~20–35 px at 1024). If recall on
  small bars is low, raise to 1280/1536 (slower) before reaching for a bigger model.
- **Small GPU (e.g. 6 GB laptop):** `batch=-1` auto-sizing can overshoot → CUDA OOM.
  Pass an explicit batch instead and keep `imgsz` high: `--batch 4` (drop to `2`
  if needed). `train.py` already sets `PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True`.
- **Start small.** A few thousand synthetic images is plenty for the first loop;
  scale up only once the real-test numbers justify it.
- **Closing the gap.** When the model is decent on real photos, label a handful
  with the annotator, add them to train (drop them in `data/annotations` + `images`
  and re-export — but move them out of `test` so you don't train on your eval set),
  and fine-tune. Repeat (active learning).
- **Next stage:** crops from detected bars → OCR → fuzzy-match to the card DB.
