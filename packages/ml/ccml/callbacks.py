"""Keras callbacks for a pipeline run: the run's metrics record, train/test validation, and
checkpoints in S3 that a retried task resumes from."""

import json
import math
import time
from pathlib import Path

import tensorflow as tf

from ccml import storage
from ccml.config import RunContext
from ccml.validation import evaluate

# Keras names the outputs of the multi-head model by position.
HEAD_NAMES = {"output_1": "cube", "output_2": "deck", "output_3": "draft", "output_4": "correlation"}
EMF_NAMESPACE = "CubeCobra/MLTraining"


def readable_logs(logs: dict) -> dict:
    renamed = {}
    for key, value in (logs or {}).items():
        for output, head in HEAD_NAMES.items():
            key = key.replace(output, head)
        renamed[key] = float(value)
    return renamed


def emit_metrics(run_id: str, values: dict) -> None:
    """One CloudWatch embedded-metric-format line; CloudWatch Logs turns it into metrics."""
    print(
        json.dumps(
            {
                "_aws": {
                    "Timestamp": int(time.time() * 1000),
                    "CloudWatchMetrics": [
                        {"Namespace": EMF_NAMESPACE, "Dimensions": [["RunId"]], "Metrics": [{"Name": k} for k in values]}
                    ],
                },
                "RunId": run_id,
                **values,
            }
        ),
        flush=True,
    )


class RunRecorder(tf.keras.callbacks.Callback):
    """Keeps ml/runs/<runId>/metrics.json (RunMetrics in packages/utils/src/ml/modelBundle.ts) current
    after every epoch, and fails the run as soon as a loss stops being finite."""

    def __init__(self, ctx: RunContext, params: dict, data_manifest: dict, previous: dict | None, resumed_from: int | None):
        super().__init__()
        self.ctx = ctx
        now = int(time.time() * 1000)
        if previous and resumed_from is not None:
            self.metrics = previous
            self.metrics["epochs"] = [e for e in previous.get("epochs", []) if e["epoch"] <= resumed_from]
            self.metrics["validations"] = [v for v in previous.get("validations", []) if v["epoch"] <= resumed_from]
            self.metrics["resumedFromEpoch"] = resumed_from
            self.metrics["params"] = params
        else:
            self.metrics = {
                "runId": ctx.run_id,
                "startedAt": now,
                "params": params,
                "data": data_manifest,
                "epochs": [],
                "validations": [],
            }
        self.metrics["status"] = "running"
        self._epoch_started = time.time()

    def on_epoch_begin(self, epoch, logs=None):
        self._epoch_started = time.time()

    def on_epoch_end(self, epoch, logs=None):
        number = epoch + 1
        values = readable_logs(logs)
        self.metrics["epochs"].append(
            {
                "epoch": number,
                "finishedAt": int(time.time() * 1000),
                "durationSeconds": round(time.time() - self._epoch_started, 1),
                "logs": values,
            }
        )
        emit_metrics(self.ctx.run_id, {**values, "epoch": number})
        self.save()
        bad = [key for key, value in values.items() if key.endswith("loss") and not math.isfinite(value)]
        if bad:
            raise RuntimeError(f"Non-finite {', '.join(bad)} at epoch {number}")

    def add_validation(self, epoch: int, train: dict, test: dict) -> None:
        self.metrics["validations"].append({"epoch": epoch, "train": train, "test": test})
        emit_metrics(
            self.ctx.run_id,
            {**{f"train_{k}": v for k, v in train.items()}, **{f"test_{k}": v for k, v in test.items()}},
        )

    def save(self) -> None:
        self.metrics["updatedAt"] = int(time.time() * 1000)
        storage.write_json(self.ctx.bucket, self.ctx.key("metrics.json"), self.metrics)

    def finish(self, status: str) -> None:
        self.metrics["status"] = status
        self.save()


class ValidationCallback(tf.keras.callbacks.Callback):
    """Scores the gate metrics on the train and test samples every `every` epochs and at the end."""

    def __init__(self, every: int, total_epochs: int, train_sample: dict, test_sample: dict, recorder: RunRecorder, tb_dir: Path):
        super().__init__()
        self.every = max(1, every)
        self.total_epochs = total_epochs
        self.samples = {"train": train_sample, "test": test_sample}
        self.recorder = recorder
        self.writer = tf.summary.create_file_writer(str(tb_dir / "validation"))

    def on_epoch_end(self, epoch, logs=None):
        number = epoch + 1
        if number % self.every != 0 and number != self.total_epochs:
            return
        scores = {split: evaluate(self.model, sample) for split, sample in self.samples.items()}
        self.recorder.add_validation(number, scores["train"], scores["test"])
        with self.writer.as_default():
            for split, values in scores.items():
                for name, value in values.items():
                    tf.summary.scalar(f"{split}/{name}", value, step=number)
        self.writer.flush()
        print(f"[validation] epoch {number}: train {scores['train']} test {scores['test']}", flush=True)


class CheckpointCallback(tf.keras.callbacks.Callback):
    """Every `every` epochs: uploads the weights to checkpoints/epoch_NNNN/, points
    checkpoints/latest.json at them, prunes old checkpoints (keeping the last `keep` and every 100th
    epoch) and syncs TensorBoard logs."""

    def __init__(self, ctx: RunContext, every: int, keep: int, tb_dir: Path):
        super().__init__()
        self.ctx = ctx
        self.every = max(1, every)
        self.keep = max(1, keep)
        self.tb_dir = tb_dir

    def on_epoch_end(self, epoch, logs=None):
        number = epoch + 1
        if number % self.every != 0:
            return
        name = f"epoch_{number:04d}"
        local = self.ctx.work_dir / "checkpoints" / name
        self.model.save_checkpoint(local)
        prefix = self.ctx.key("checkpoints", name) + "/"
        storage.upload_dir(local, self.ctx.bucket, prefix)
        storage.write_json(self.ctx.bucket, self.ctx.key("checkpoints", "latest.json"), {"epoch": number, "prefix": prefix})
        for path in local.iterdir():
            path.unlink()
        local.rmdir()
        self._prune()
        if self.tb_dir.exists():
            storage.upload_dir(self.tb_dir, self.ctx.bucket, self.ctx.key("tensorboard") + "/")
        print(f"[checkpoint] epoch {number} -> s3://{self.ctx.bucket}/{prefix}", flush=True)

    def _prune(self):
        keys = storage.list_keys(self.ctx.bucket, self.ctx.key("checkpoints", "epoch_"))
        epochs = sorted({int(key.split("epoch_")[1].split("/")[0]) for key in keys})
        keep = set(epochs[-self.keep:]) | {e for e in epochs if e % 100 == 0}
        stale = [key for key in keys if int(key.split("epoch_")[1].split("/")[0]) not in keep]
        if stale:
            storage.delete_keys(self.ctx.bucket, stale)
