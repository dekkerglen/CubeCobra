# Name-bar Annotator

A small local tool for labeling **oriented card-name boxes** on deck photos, to
build the training set for the deck-photo card-name detector.

Each label is a fixed-aspect (25:2, name + mana cost) box defined by a **center**,
a **scale**, and an **angle** (snapped to 2°), so it works on photos where cards
sit at different rotations.

## Run

```bash
# from the repo root
npm install                       # first time only
npm start -w @cubecobra/annotator
```

Then open the URL Vite prints (default http://localhost:5173).

Point it at your photos by either:

- dropping image files into `packages/annotator/images/`, or
- starting with a custom folder:
  `ANNOTATOR_IMAGES_DIR=/path/to/photos npm start -w @cubecobra/annotator`

Supported: `.jpg .jpeg .png .webp .gif .bmp`.

## Annotating

- **Click** on the image to place a box center.
- **Drag up/down** (while holding) to set the box angle — snaps to 2°.
- The starting angle carries over from the last box, so a run of same-orientation
  cards is one click each.
- **Scale slider** sets the box size for the whole image — it resizes every existing box (they all share one scale) and is saved with the annotation.
- **Right-click** a box to delete it.
- **a / d** (or ← / →) navigate images; **z / Backspace** undoes the last box.

Annotations save automatically after every change to
`packages/annotator/data/annotations/<image>.json`.

## Annotation format

One JSON file per image:

```json
{
  "image": "deck1.jpg",
  "width": 4032,
  "height": 3024,
  "aspect": 12.5,
  "scale": 0.18,
  "boxes": [
    { "cx": 0.51, "cy": 0.33, "angle": 30 }
  ]
}
```

- `scale` — shared box width as a fraction of image width (every box in the image uses it). Height is `scale / aspect` (in width units), i.e. the box is always 25:2. The scale slider edits this and it's saved per image.
- `cx`, `cy` — box center, normalized to `[0,1]` (`cx` by image width, `cy` by image height).
- `angle` — degrees, clockwise on screen, always a multiple of 2.
- `width` / `height` — the image's natural pixel size (so the normalized values can be converted back to pixels for training).

These are resolution-independent and convert cleanly to an oriented-bounding-box
training format (e.g. YOLO-OBB) in a later step.

## Synthetic dataset

Hand-labeling 46k photos is infeasible, so we also generate fake "pile of cards
on a table" photos with perfect ground-truth labels to pre-train the detector.

```bash
# 1. one-time prerequisite: download Scryfall's "All Cards" bulk export (~2 GB)
npm run dataset:bulk -w @cubecobra/annotator

# 2. generate images (knobs are constants at the top of the script)
npm run dataset:generate -w @cubecobra/annotator
```

- **`scripts/download-bulk.mjs`** — fetches the All Cards bulk export to
  `data/scryfall/all-cards.json` (skips if present; `--force` to refresh).
- **`scripts/generate-dataset.mjs`** — the main thread streams the bulk into a
  compact in-memory index (only `{id, name, lang, layout}`; image URLs are rebuilt
  from the id) and picks cards uniformly at random; rendering is **fanned out
  across worker threads**. Each photo: a random card **art crop** background →
  cards in distinct, mostly-separated overlapping **stacks** with ±5° pitch jitter
  → **proper occlusion** (a name bar is kept only if enough of it is uncovered and
  it lands in-frame) → a keystone **perspective** warp with global
  **brightness/contrast** jitter → **glare** highlights → a random
  **0/90/180/270** rotation. Tune via the constants at the top (`NUM_IMAGES`,
  `MIN_CARDS`, `MAX_CARDS`, `WORKERS`, `LANG_FILTER`, stack/occlusion/distortion
  knobs, …). Card images are **lazily downloaded and cached** to `data/cardpool/`
  as they're first used, so reruns avoid the network.

  Split/room/fuse cards are read sideways, so each half's name is labeled as a
  **vertical bar along the long edge**; oversized layouts (schemes, planes,
  vanguards, …) are excluded.

Output lands in `data/synthetic/` (kept separate from real captures):

- `images/<uuid>.jpg` — the generated photo.
- `annotations/<uuid>.jpg.json` — ground truth as **perspective-correct quads**
  (4 corners, normalized; corner 0→1 runs along the text), each tagged with the
  source card `name`, `scryfall_id`, `lang`, and `layout` (handy for the later
  OCR-validation step). Note: `name` is the English oracle name even for
  non-English printings (Scryfall keeps the localized name separately), so the
  pictured text won't always match `name` unless you set `LANG_FILTER = 'en'`.

### Viewing it

In the app, click **Synthetic ▦** to browse the generated images with their
ground-truth quads overlaid (read-only), plus a **Captures** panel showing each
name bar **deskewed to an upright crop** (the "card sub-images") — a quick way to
sanity-check realism and label accuracy. `a`/`d` navigate, `l` toggles the overlay.

## Detector model

The synthetic data trains a YOLO-OBB name-bar detector that ultimately runs
**client-side in the browser**. The pipeline is npm scripts (Python under the hood,
via `training/.venv`); see [`training/README.md`](training/README.md) for the full
flow and tuning notes.

```bash
npm run model:dataset -w @cubecobra/annotator   # annotator labels -> YOLO-OBB dataset
npm run model:train   -w @cubecobra/annotator -- --model yolo11n-obb.pt --epochs 3 --batch 8 --mosaic 0
npm run model:export  -w @cubecobra/annotator   # trained model -> public/models/namebar.onnx
```

Then `npm start` and click **Predict ◎** to run the model in-browser on the real
test photos (confidence slider, ground-truth overlay, `a`/`d` to navigate). Re-run
`model:export` after each training run and hard-refresh the tab to load new weights.
