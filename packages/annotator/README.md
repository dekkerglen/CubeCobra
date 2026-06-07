# Name-bar Annotator

A small local tool for labeling **oriented card-name boxes** on deck photos, to
build the training set for the deck-photo card-name detector.

Each label is a fixed-aspect (25:2, name + mana cost) box defined by a **center**,
a **scale**, and an **angle** (snapped to 10°), so it works on photos where cards
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
- **Drag up/down** (while holding) to set the box angle — snaps to 10°.
- The starting angle carries over from the last box, so a run of same-orientation
  cards is one click each.
- **Scale slider** sizes new boxes (and the live ghost preview).
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
  "boxes": [
    { "cx": 0.51, "cy": 0.33, "w": 0.18, "angle": 30 }
  ]
}
```

- `cx`, `cy` — box center, normalized to `[0,1]` (`cx` by image width, `cy` by image height).
- `w` — box width as a fraction of image width. Height is `w / aspect` (in width units), i.e. the box is always 25:2.
- `angle` — degrees, clockwise on screen, always a multiple of 10.
- `width` / `height` — the image's natural pixel size (so the normalized values can be converted back to pixels for training).

These are resolution-independent and convert cleanly to an oriented-bounding-box
training format (e.g. YOLO-OBB) in a later step.
