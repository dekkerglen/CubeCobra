"""Same cases as packages/jobs/src/test/ml/gateMetrics.test.ts: both implementations must agree."""

import numpy as np

from ccml.metrics import cube_recall, deck_accuracy, pick_rank, split_cube


def scores_from(length: int, values: dict) -> np.ndarray:
    scores = np.zeros(length, dtype=np.float32)
    for index, value in values.items():
        scores[index] = value
    return scores


def test_split_cube_hides_every_fifth_card_by_sorted_index():
    assert split_cube([7, 3, 3, 9, 1, 5]) == ([3, 5, 7, 9], [1])
    assert split_cube([9, 8, 7, 6, 5, 4, 3, 2, 1, 0]) == ([1, 2, 3, 4, 6, 7, 8, 9], [0, 5])


def test_cube_recall_counts_hidden_cards_in_top_scores_of_cards_not_fed():
    scores = scores_from(12, {0: 0.9, 5: 0.1, 10: 0.8, 11: 0.7, 1: 1, 2: 1})
    assert cube_recall(scores, [1, 2, 3, 4, 6, 7, 8, 9], [0, 5]) == 0.5


def test_cube_recall_is_zero_with_nothing_hidden():
    assert cube_recall(scores_from(3, {}), [1], []) == 0.0


def test_deck_accuracy_measures_mainboard_share_of_top_pool_cards():
    scores = scores_from(6, {1: 0.9, 2: 0.1, 3: 0.8, 4: 0.2, 5: 1})
    assert deck_accuracy(scores, [1, 2, 3, 4], [1, 2]) == 0.5


def test_pick_rank_counts_pack_cards_scored_strictly_above_the_pick():
    logits = scores_from(4, {1: 0.5, 2: 0.4, 3: 0.4})
    assert pick_rank(logits, [1, 2, 3], 2) == 1
    assert pick_rank(logits, [1, 2, 3], 1) == 0
