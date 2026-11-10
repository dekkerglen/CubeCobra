"""The four gate metrics, defined exactly as packages/jobs/src/ml/gateMetrics.ts defines them, so a
run's validation numbers and its promotion-gate numbers mean the same thing. Change both together;
tests/test_metrics.py and gateMetrics.test.ts share their cases.

  cube_recall    hide every 5th card of a cube (by sorted index), feed the rest, and measure how many
                 hidden cards appear in the top ceil(1.2 x hidden) scores among cards not fed
  deck_accuracy  feed a deck's pool (main + side), rank the pool by score, and measure how much of
                 the top |mainboard| is the mainboard the player built
  pick rank      feed the pool before a pick; top-1 / top-3 = how many pack cards score strictly
                 above the human's pick is below 1 / 3

Ties count in the model's favor, and ranking ties break toward the lower card index.
"""

import math

import numpy as np


def split_cube(cards) -> tuple[list[int], list[int]]:
    """(visible, hidden): sorted unique cards, every 5th hidden."""
    ordered = sorted(set(int(card) for card in cards))
    visible = [card for i, card in enumerate(ordered) if i % 5 != 0]
    hidden = [card for i, card in enumerate(ordered) if i % 5 == 0]
    return visible, hidden


def _rank(scores: np.ndarray, cards: np.ndarray) -> np.ndarray:
    """cards ordered by descending score, ties by ascending index."""
    return cards[np.lexsort((cards, -scores[cards].astype(np.float64)))]


def cube_recall(scores: np.ndarray, visible, hidden) -> float:
    if not hidden:
        return 0.0
    k = math.ceil(len(hidden) * 1.2)
    candidates = np.setdiff1d(np.arange(len(scores)), np.array(visible, dtype=np.int64))
    top = set(_rank(scores, candidates)[:k].tolist())
    return sum(1 for card in hidden if card in top) / len(hidden)


def deck_accuracy(scores: np.ndarray, pool, mainboard) -> float:
    main = set(int(card) for card in mainboard)
    if not main:
        return 0.0
    ranked = _rank(scores, np.array(sorted(set(int(card) for card in pool)), dtype=np.int64))
    return sum(1 for card in ranked[: len(main)].tolist() if card in main) / len(main)


def pick_rank(logits: np.ndarray, pack, pick: int) -> int:
    others = [card for card in set(int(card) for card in pack) if card != pick]
    return int(sum(1 for card in others if logits[card] > logits[pick]))
