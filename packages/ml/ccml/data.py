"""Streams the processed training data (packages/jobs/src/ml/processTrainingData.ts) into a
tf.data.Dataset without ever holding more than one shard per stream in memory.

Every element is ((cubes, deck_pools, (draft_pools, draft_packs), corr_cards),
(cube_targets, deck_targets, pick_targets, corr_targets)).
"""

import json
import math
from pathlib import Path

import numpy as np
import tensorflow as tf

from ccml.config import TrainConfig


def multi_hot(indices, num_cards: int) -> np.ndarray:
    vec = np.zeros(num_cards, dtype=np.float32)
    vec[list(indices)] = 1.0
    return vec


def shard_files(directory: Path) -> list[Path]:
    return sorted(directory.glob("*.json"))


def _augment_cube(indices, num_cards, pop_sampler, rare_sampler, noise, noise_std, rng):
    """A noisy copy of the cube for the recommender to repair.

    Cards cut from the input are biased toward rare cards (rare_sampler ∝ 1/frequency) so the model
    learns to suggest less obvious cards; fake additions are biased toward popular cards
    (pop_sampler ∝ frequency) so it learns those are fine to cut. A quarter of the cut cards are also
    dropped from the target so the target isn't always the exact original list.
    """
    cube = multi_hot(indices, num_cards)
    includes = np.array(indices, dtype=np.int32)
    size = len(includes)

    noise_level = np.clip(rng.normal(noise, noise_std), a_min=0.05, a_max=0.8)
    flip_amount = int(size * noise_level)
    if flip_amount == 0:
        return cube, cube

    include_probs = rare_sampler[includes] / rare_sampler[includes].sum()
    flip_include = rng.choice(includes, flip_amount, p=include_probs, replace=False)

    excludes = np.setdiff1d(np.arange(num_cards, dtype=np.int32), includes, assume_unique=True)
    exclude_probs = pop_sampler[excludes] / pop_sampler[excludes].sum()
    flip_exclude = rng.choice(excludes, flip_amount, p=exclude_probs, replace=False)

    x_cube, y_cube = cube.copy(), cube.copy()
    x_cube[flip_include] = 0.0
    x_cube[flip_exclude] = 1.0
    y_cube[rng.choice(flip_include, flip_amount // 4, replace=False)] = 0.0
    return x_cube, y_cube


def _cube_stream(files, num_cards, pop_sampler, rare_sampler, noise, noise_std, rng):
    while True:
        rng.shuffle(files)
        for path in files:
            for indices in json.loads(path.read_text()):
                yield _augment_cube(indices, num_cards, pop_sampler, rare_sampler, noise, noise_std, rng)


def _deck_stream(files, num_cards, rng):
    while True:
        rng.shuffle(files)
        for path in files:
            for deck in json.loads(path.read_text()):
                main = multi_hot(deck["mainboard"], num_cards)
                side = multi_hot(deck["sideboard"], num_cards)
                yield np.clip(main + side, 0.0, 1.0), main


def _pick_stream(files, num_cards, rng):
    while True:
        rng.shuffle(files)
        for path in files:
            for pick in json.loads(path.read_text()):
                pool = multi_hot(pick["pool"], num_cards)
                pack = multi_hot(pick["pack"], num_cards)
                yield (pool, pack), multi_hot([pick["pick"]], num_cards)


def _corr_stream(y_corr, rng):
    """One card in, the distribution of cards it shares mainboards with out."""
    num_cards = y_corr.shape[0]
    while True:
        for card in rng.permutation(num_cards):
            yield multi_hot([card], num_cards), y_corr[card]


def load_correlations(path: Path, num_cards: int) -> np.ndarray:
    """Row-normalized co-occurrence counts. Converted in place to keep peak memory near one matrix."""
    raw = np.fromfile(path, dtype="<i4")
    if raw.size != num_cards * num_cards:
        raise ValueError(f"{path} holds {raw.size} counts, expected {num_cards}x{num_cards}")
    corr = raw.astype(np.float32)
    del raw
    corr = corr.reshape((num_cards, num_cards))
    corr /= corr.sum(axis=1, keepdims=True) + 1.0
    return corr


def _prepare(ds: tf.data.Dataset, record_count: int, batch_size: int, steps_per_epoch: int, epochs: int):
    """Repeats the example stream so it yields exactly steps_per_epoch x epochs full batches."""
    needed = steps_per_epoch * epochs * batch_size
    repeats = math.ceil(needed / max(record_count, 1))
    return ds.repeat(repeats).take(needed).batch(batch_size, drop_remainder=True).prefetch(tf.data.AUTOTUNE)


def build_training_dataset(data_dir: Path, manifest: dict, config: TrainConfig):
    """Returns (dataset, num_cards, steps_per_epoch, epochs, is_land_mask)."""
    num_cards = manifest["numCards"]
    train = data_dir / "train"
    counts = {
        "cube": manifest["train"]["cubes"],
        "deck": manifest["train"]["decks"],
        "pick": manifest["train"]["picks"],
        "card": num_cards,
    }

    frequencies = np.array(json.loads((data_dir / "oracleFrequency.json").read_text()), dtype=np.float32)
    rare_sampler = 1.0 / (frequencies + 1.0)
    pop_sampler = frequencies + 1.0
    is_land_mask = np.array(json.loads((data_dir / "isLand.json").read_text()), dtype=np.float32)
    y_corr = load_correlations(data_dir / "correlations.bin", num_cards)

    batch_size = config.batch_size
    steps_per_epoch = math.ceil(counts[config.primary_stream] / batch_size)
    # Enough epochs that every stream is seen at least once.
    min_epochs = max(math.ceil(count / (steps_per_epoch * batch_size)) for count in counts.values())
    epochs = max(config.epochs, min_epochs)
    print(f"{steps_per_epoch} steps per epoch, {epochs} epochs (requested {config.epochs}); counts {counts}")

    # One generator per stream: tf.data may pull the streams from different threads.
    cube_rng, deck_rng, pick_rng, corr_rng = (np.random.default_rng(s) for s in np.random.SeedSequence(config.seed).spawn(4))
    vec = tf.TensorSpec((num_cards,), tf.float32)
    cube_files, deck_files, pick_files = (shard_files(train / kind) for kind in ("cubes", "decks", "picks"))

    cube_ds = tf.data.Dataset.from_generator(
        lambda: _cube_stream(cube_files, num_cards, pop_sampler, rare_sampler, config.noise, config.noise_std, cube_rng),
        output_signature=(vec, vec),
    )
    deck_ds = tf.data.Dataset.from_generator(
        lambda: _deck_stream(deck_files, num_cards, deck_rng), output_signature=(vec, vec)
    )
    pick_ds = tf.data.Dataset.from_generator(
        lambda: _pick_stream(pick_files, num_cards, pick_rng), output_signature=((vec, vec), vec)
    )
    corr_ds = tf.data.Dataset.from_generator(lambda: _corr_stream(y_corr, corr_rng), output_signature=(vec, vec))

    def merge(cube, deck, pick, corr):
        (x_cube, y_cube), (x_deck, y_deck), ((pool, pack), y_pick), (x_corr, y_corr_row) = cube, deck, pick, corr
        return (x_cube, x_deck, (pool, pack), x_corr), (y_cube, y_deck, y_pick, y_corr_row)

    dataset = tf.data.Dataset.zip(
        (
            _prepare(cube_ds, counts["cube"], batch_size, steps_per_epoch, epochs),
            _prepare(deck_ds, counts["deck"], batch_size, steps_per_epoch, epochs),
            _prepare(pick_ds, counts["pick"], batch_size, steps_per_epoch, epochs),
            _prepare(corr_ds, counts["card"], batch_size, steps_per_epoch, epochs),
        )
    )
    dataset = dataset.map(merge, num_parallel_calls=tf.data.AUTOTUNE).prefetch(tf.data.AUTOTUNE)
    return dataset, num_cards, steps_per_epoch, epochs, is_land_mask
