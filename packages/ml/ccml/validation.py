"""Validation during training: the gate metrics on fixed samples of the train and test splits.

The samples are the first N usable records of each split's shards, so every validation in a run (and
every resumed run) scores the same examples. A growing gap between train and test means the model is
memorizing rather than generalizing.
"""

import json
from pathlib import Path

import numpy as np
import tensorflow as tf

from ccml.data import shard_files
from ccml.metrics import cube_recall, deck_accuracy, pick_rank, split_cube

BATCH_SIZE = 256


def _first(directory: Path, limit: int, accept) -> list:
    out = []
    for path in shard_files(directory):
        for record in json.loads(path.read_text()):
            if accept(record):
                out.append(record)
                if len(out) >= limit:
                    return out
    return out


def load_sample(data_dir: Path, split: str, sizes: dict) -> dict:
    root = data_dir / split
    return {
        "cubes": [split_cube(cube) for cube in _first(root / "cubes", sizes["cubes"], lambda c: len(set(c)) >= 10)],
        "decks": _first(root / "decks", sizes["decks"], lambda d: len(d["mainboard"]) > 0),
        "picks": _first(root / "picks", sizes["picks"], lambda p: True),
    }


def _decode(encoder, decoder, rows: list, num_cards: int) -> np.ndarray:
    out = []
    for start in range(0, len(rows), BATCH_SIZE):
        batch = np.zeros((len(rows[start:start + BATCH_SIZE]), num_cards), dtype=np.float32)
        for i, row in enumerate(rows[start:start + BATCH_SIZE]):
            batch[i, list(row)] = 1.0
        out.append(decoder(encoder(tf.constant(batch), training=False), training=False).numpy())
    return np.concatenate(out) if out else np.zeros((0, num_cards), dtype=np.float32)


def evaluate(model, sample: dict) -> dict:
    """Gate metrics (camelCase, as GateMetrics in packages/utils/src/ml/modelBundle.ts)."""
    n = model.num_cards
    cubes, decks, picks = sample["cubes"], sample["decks"], sample["picks"]

    cube_scores = _decode(model.encoder, model.cube_decoder, [visible for visible, _ in cubes], n)
    pools = [deck["mainboard"] + deck["sideboard"] for deck in decks]
    deck_scores = _decode(model.encoder, model.deck_build_decoder, pools, n)
    pick_logits = _decode(model.encoder, model.draft_decoder, [pick["pool"] for pick in picks], n)
    ranks = [pick_rank(pick_logits[i], pick["pack"], pick["pick"]) for i, pick in enumerate(picks)]

    def mean(values):
        return float(np.mean(values)) if values else 0.0

    return {
        "cubeRecall": mean([cube_recall(cube_scores[i], visible, hidden) for i, (visible, hidden) in enumerate(cubes)]),
        "deckAccuracy": mean([deck_accuracy(deck_scores[i], pools[i], deck["mainboard"]) for i, deck in enumerate(decks)]),
        "pickTop1": mean([1.0 if rank < 1 else 0.0 for rank in ranks]),
        "pickTop3": mean([1.0 if rank < 3 else 0.0 for rank in ranks]),
    }
