"""Retraining stage 3: trains the model on the run's processed data.

    ML_RUN_ID=<run id> ML_RUNS_BUCKET=<bucket> python -m ccml.train

Resumable: when checkpoints/latest.json exists (a previous attempt of this task died), training
continues from that epoch. Optimizer state isn't checkpointed, so Adam restarts its moment
estimates on resume. A run whose final weights already exist exits without training.
"""

import os

os.environ.setdefault("TF_USE_LEGACY_KERAS", "1")

import json  # noqa: E402
import platform  # noqa: E402
import urllib.request  # noqa: E402

import tensorflow as tf  # noqa: E402
from tensorflow.keras.metrics import TopKCategoricalAccuracy  # noqa: E402

from ccml import storage  # noqa: E402
from ccml.callbacks import CheckpointCallback, RunRecorder, ValidationCallback  # noqa: E402
from ccml.config import load_config, run_context  # noqa: E402
from ccml.data import build_training_dataset  # noqa: E402
from ccml.model import CubeCobraMLSystem, make_draft_loss  # noqa: E402
from ccml.tf_metrics import TopRatedPercent  # noqa: E402
from ccml.validation import load_sample  # noqa: E402


def environment_info() -> dict:
    """What the run trained with, beyond its config."""
    gpus = tf.config.list_physical_devices("GPU")
    gpu = tf.config.experimental.get_device_details(gpus[0]).get("device_name") if gpus else None
    digest = None
    metadata_uri = os.environ.get("ECS_CONTAINER_METADATA_URI_V4")
    if metadata_uri:
        try:
            with urllib.request.urlopen(metadata_uri, timeout=2) as response:
                digest = json.load(response).get("ImageID")
        except OSError:
            pass
    return {
        "gpu": gpu,
        "tensorflow": tf.__version__,
        "python": platform.python_version(),
        "gitSha": os.environ.get("GIT_SHA"),
        "imageDigest": digest,
    }


def main() -> None:
    ctx = run_context()
    config = load_config()

    if storage.exists(ctx.bucket, ctx.key("checkpoints", "final", "encoder.weights.h5")):
        print(f"Run {ctx.run_id} already has final weights; nothing to do")
        return

    info = environment_info()
    print(f"Training run {ctx.run_id} on {info['gpu'] or 'CPU (no GPU found)'}", flush=True)
    tf.keras.utils.set_random_seed(config.seed)

    data_dir = ctx.work_dir / "data"
    if storage.download_prefix(ctx.bucket, ctx.key("data") + "/", data_dir) == 0:
        raise RuntimeError(f"No processed data at s3://{ctx.bucket}/{ctx.key('data')}/")
    data_manifest = json.loads((data_dir / "manifest.json").read_text())

    dataset, num_cards, steps_per_epoch, epochs, is_land_mask = build_training_dataset(data_dir, data_manifest, config)

    model = CubeCobraMLSystem(num_cards)
    model.build_submodels()
    weights = config.loss_weights
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=config.learning_rate),
        loss=[
            "binary_crossentropy",
            "binary_crossentropy",
            make_draft_loss(is_land_mask, config.land_penalty_weight),
            "kullback_leibler_divergence",
        ],
        loss_weights=[weights["cube"], weights["deck"], weights["draft"], weights["correlation"]],
        metrics={
            "output_1": TopRatedPercent("trp"),
            "output_2": TopRatedPercent("trp"),
            "output_3": [TopKCategoricalAccuracy(k=1, name="top1"), TopKCategoricalAccuracy(k=3, name="top3")],
            "output_4": TopRatedPercent("trp"),
        },
    )

    initial_epoch = 0
    previous = None
    latest = storage.read_json(ctx.bucket, ctx.key("checkpoints", "latest.json"))
    if latest:
        resume_dir = ctx.work_dir / "resume"
        storage.download_prefix(ctx.bucket, latest["prefix"], resume_dir)
        model.load_checkpoint(resume_dir)
        initial_epoch = int(latest["epoch"])
        previous = storage.read_json(ctx.bucket, ctx.key("metrics.json"))
        print(f"Resuming from epoch {initial_epoch}", flush=True)

    params = {
        **config.to_dict(),
        "epochsFinal": epochs,
        "stepsPerEpoch": steps_per_epoch,
        "numCards": num_cards,
        "optimizer": "adam",
        **info,
    }
    recorder = RunRecorder(ctx, params, data_manifest, previous, initial_epoch if latest else None)
    tb_dir = ctx.work_dir / "tensorboard"
    callbacks = [
        tf.keras.callbacks.TensorBoard(log_dir=str(tb_dir), update_freq="epoch", write_graph=False, profile_batch=0),
        ValidationCallback(
            config.validate_every,
            epochs,
            load_sample(data_dir, "train", config.validation_sample),
            load_sample(data_dir, "test", config.validation_sample),
            recorder,
            tb_dir,
        ),
        recorder,
        CheckpointCallback(ctx, config.checkpoint_every, config.keep_checkpoints, tb_dir),
    ]

    try:
        model.fit(
            dataset,
            epochs=epochs,
            initial_epoch=initial_epoch,
            steps_per_epoch=steps_per_epoch,
            callbacks=callbacks,
            verbose=2,
        )
        final_dir = ctx.work_dir / "checkpoints" / "final"
        model.save_checkpoint(final_dir)
        storage.upload_dir(final_dir, ctx.bucket, ctx.key("checkpoints", "final") + "/")
        if tb_dir.exists():
            storage.upload_dir(tb_dir, ctx.bucket, ctx.key("tensorboard") + "/")
        recorder.finish("completed")
    except BaseException:
        recorder.finish("failed")
        raise


if __name__ == "__main__":
    main()
