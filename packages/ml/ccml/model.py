"""The recommender network: one shared card-set encoder and a decoder per task.

Ported from the CubeCobraML repo without the cube-context branch, which the v3 model dropped
(draft_decoder takes the 128-dim pool embedding directly).
"""

import os

# Keep TF 2.16+ on the Keras-2 code path: the sub-models are saved and reloaded per directory, which
# Keras 3 broke. Must be set before tensorflow is imported.
os.environ.setdefault("TF_USE_LEGACY_KERAS", "1")

from pathlib import Path  # noqa: E402

import numpy as np  # noqa: E402
import tensorflow as tf  # noqa: E402
from tensorflow.keras.layers import Dense  # noqa: E402
from tensorflow.keras.models import Model, Sequential  # noqa: E402

EMBEDDING_DIM = 128


def _encoder(name: str) -> Sequential:
    return Sequential(
        [
            Dense(512, activation="relu", name=name + "_e1"),
            Dense(256, activation="relu", name=name + "_e3"),
            Dense(EMBEDDING_DIM, activation="linear", name=name + "_bottleneck"),
        ]
    )


def _decoder(name: str, output_dim: int, output_act) -> Sequential:
    return Sequential(
        [
            Dense(256, activation="relu", name=name + "_d1"),
            Dense(512, activation="relu", name=name + "_d3"),
            Dense(output_dim, activation=output_act, name=name + "_reconstruction"),
        ]
    )


class CubeCobraMLSystem(Model):
    """Inputs: (cubes, deck_pools, (draft_pools, draft_packs), correlation_cards).
    Outputs, in order: cube recommendations, deck builds, draft picks, card correlations."""

    SUBMODELS = ("encoder", "cube_decoder", "draft_decoder", "deck_build_decoder", "correlation_decoder")

    def __init__(self, num_cards: int):
        super().__init__()
        self.num_cards = num_cards
        # Layer names are kept from the original model so old checkpoints still map onto them.
        self.encoder = _encoder("encoder")
        self.cube_decoder = _decoder("recommend", num_cards, tf.nn.sigmoid)
        self.draft_decoder = _decoder("draft", num_cards, "linear")
        self.deck_build_decoder = _decoder("deck_build", num_cards, tf.nn.sigmoid)
        self.correlation_decoder = _decoder("correlate", num_cards, tf.nn.softmax)

    def build_submodels(self) -> None:
        """Creates every variable up front, so checkpoints can be loaded before the first batch."""
        self.encoder.build((None, self.num_cards))
        for name in self.SUBMODELS[1:]:
            getattr(self, name).build((None, EMBEDDING_DIM))

    def call(self, inputs, training=None):
        cubes, deck_pools, (draft_pools, draft_packs), corr_cards = inputs
        return [
            self.cube_decoder(self.encoder(cubes, training=training), training=training),
            self.deck_build_decoder(self.encoder(deck_pools, training=training), training=training),
            self.draft(draft_pools, draft_packs, training=training),
            self.correlation_decoder(self.encoder(corr_cards, training=training), training=training),
        ]

    def draft(self, pools, packs, training=None):
        """Pick probabilities over the cards in each pack."""
        logits = self.draft_decoder(self.encoder(pools, training=training), training=training)
        mask = 1e9 * (1 - packs)
        return tf.nn.softmax(logits * packs - mask)

    # Checkpoints hold only each sub-model's weights (.h5): rebuilding the architecture from this
    # file and loading weights keeps them small and independent of the Keras save format.
    def save_checkpoint(self, directory: Path) -> None:
        directory.mkdir(parents=True, exist_ok=True)
        for name in self.SUBMODELS:
            getattr(self, name).save_weights(str(directory / f"{name}.weights.h5"))

    def load_checkpoint(self, directory: Path) -> None:
        for name in self.SUBMODELS:
            getattr(self, name).load_weights(str(directory / f"{name}.weights.h5"))


def make_draft_loss(is_land_mask: np.ndarray, land_penalty_weight: float):
    """Categorical crossentropy, plus a penalty for the probability the bot puts on lands when the
    human picked a non-land. The model has to learn when a land pick is right instead of collapsing
    onto never picking lands."""
    mask = tf.constant(np.asarray(is_land_mask, dtype=np.float32).reshape(1, -1))
    weight = float(land_penalty_weight)

    def draft_loss(y_true, y_pred):
        cce = tf.keras.losses.categorical_crossentropy(y_true, y_pred)
        human_picked_land = tf.reduce_sum(y_true * mask, axis=-1)
        bot_land_prob = tf.reduce_sum(y_pred * mask, axis=-1)
        return cce + weight * bot_land_prob * (1.0 - human_picked_land)

    draft_loss.__name__ = "draft_loss"
    return draft_loss
