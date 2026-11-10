"""Training configuration and the paths of one retraining run.

The state machine passes ML_RUN_ID and the task definition sets ML_RUNS_BUCKET; everything a run
reads or writes lives under s3://<ML_RUNS_BUCKET>/ml/runs/<ML_RUN_ID>/ (layout in
packages/utils/src/ml/modelBundle.ts). Hyperparameters live in train-config.json, versioned with
the code, so every run records exactly what it trained with.
"""

import json
import os
import re
from dataclasses import asdict, dataclass, field
from pathlib import Path

PACKAGE_ROOT = Path(__file__).resolve().parent.parent

# Sub-models the site loads. The correlation decoder is trained (it regularizes the shared
# encoder) but never shipped.
PRODUCTION_MODELS = ("encoder", "cube_decoder", "deck_build_decoder", "draft_decoder")

_VERSION_PATTERN = re.compile(r"^[A-Za-z0-9._-]{1,64}$")


@dataclass(frozen=True)
class TrainConfig:
    # Requested epochs; raised if needed so every stream is seen at least once.
    epochs: int = 200
    batch_size: int = 256
    # Stream whose size defines an epoch: cube | deck | pick | card.
    primary_stream: str = "cube"
    learning_rate: float = 0.001
    loss_weights: dict = field(default_factory=lambda: {"cube": 1.0, "deck": 1.0, "draft": 1.0, "correlation": 1.0})
    # Extra draft loss when the bot favors lands but the human took a non-land.
    land_penalty_weight: float = 1.0
    # Average share (and spread) of a cube's cards swapped out when training the recommender.
    noise: float = 0.2
    noise_std: float = 0.1
    checkpoint_every: int = 10
    validate_every: int = 10
    # Checkpoints kept in S3 besides every 100th epoch.
    keep_checkpoints: int = 3
    seed: int = 42
    # Examples per split for validation; matches GATE_SAMPLE in packages/jobs/src/ml/config.ts.
    validation_sample: dict = field(default_factory=lambda: {"cubes": 2000, "decks": 5000, "picks": 20000})

    def to_dict(self) -> dict:
        return asdict(self)


def load_config() -> TrainConfig:
    path = Path(os.environ.get("ML_TRAIN_CONFIG", PACKAGE_ROOT / "train-config.json"))
    values = json.loads(path.read_text()) if path.exists() else {}
    unknown = set(values) - set(TrainConfig.__dataclass_fields__)
    if unknown:
        raise ValueError(f"Unknown keys in {path}: {sorted(unknown)}")
    return TrainConfig(**values)


@dataclass(frozen=True)
class RunContext:
    run_id: str
    bucket: str
    work_dir: Path

    @property
    def prefix(self) -> str:
        return f"ml/runs/{self.run_id}/"

    def key(self, *parts: str) -> str:
        return self.prefix + "/".join(parts)


def run_context() -> RunContext:
    run_id = os.environ.get("ML_RUN_ID", "")
    bucket = os.environ.get("ML_RUNS_BUCKET", "")
    if not _VERSION_PATTERN.match(run_id):
        raise ValueError(f"ML_RUN_ID is missing or invalid: {run_id!r}")
    if not bucket:
        raise ValueError("ML_RUNS_BUCKET is not set")
    work_dir = Path(os.environ.get("ML_WORK_DIR", "/tmp/ml")) / run_id
    work_dir.mkdir(parents=True, exist_ok=True)
    return RunContext(run_id=run_id, bucket=bucket, work_dir=work_dir)
