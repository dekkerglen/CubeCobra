"""Retraining stage 4: turns the run's final weights into the bundle the site loads.

    ML_RUN_ID=<run id> ML_RUNS_BUCKET=<bucket> python -m ccml.package

Writes ml/runs/<runId>/bundle/: a TF.js graph model per production sub-model,
indexToOracleMap.json, parity.json (Keras outputs on fixed inputs, which the evaluate stage checks
the converted models against) and manifest.json. The archetype stage adds archetypes/ afterwards.
"""

import os

os.environ.setdefault("TF_USE_LEGACY_KERAS", "1")

import json  # noqa: E402
import platform  # noqa: E402
import shutil  # noqa: E402
import subprocess  # noqa: E402
import time  # noqa: E402

import numpy as np  # noqa: E402
import tensorflow as tf  # noqa: E402

from ccml import storage  # noqa: E402
from ccml.config import PRODUCTION_MODELS, run_context  # noqa: E402
from ccml.model import CubeCobraMLSystem  # noqa: E402

# tensorflowjs pins its own TensorFlow and protobuf, so the converter lives in a separate virtualenv
# (see Dockerfile).
TFJS_CONVERTER = os.environ.get("TFJS_CONVERTER", "/opt/tfjs/bin/tensorflowjs_converter")
TFJS_PYTHON = os.environ.get("TFJS_PYTHON", "/opt/tfjs/bin/python")

PARITY_INPUTS = 16
PARITY_OUTPUTS = 512


def tfjs_version() -> str:
    result = subprocess.run(
        [TFJS_PYTHON, "-c", "import tensorflowjs; print(tensorflowjs.__version__)"],
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout.strip()


def parity_reference(model: CubeCobraMLSystem, cubes: list) -> dict:
    """Keras outputs for the first test cubes; decoder outputs at evenly spaced card indices."""
    n = model.num_cards
    inputs = [sorted(set(cube)) for cube in cubes[:PARITY_INPUTS]]
    batch = np.zeros((len(inputs), n), dtype=np.float32)
    for i, cards in enumerate(inputs):
        batch[i, cards] = 1.0
    embedding = model.encoder(tf.constant(batch), training=False)
    indices = sorted(set(np.linspace(0, n - 1, PARITY_OUTPUTS).round().astype(int).tolist()))
    return {
        "inputs": inputs,
        "encoder": embedding.numpy().tolist(),
        "decoders": {
            name: {"indices": indices, "outputs": getattr(model, name)(embedding, training=False).numpy()[:, indices].tolist()}
            for name in PRODUCTION_MODELS[1:]
        },
    }


def main() -> None:
    ctx = run_context()

    final_dir = ctx.work_dir / "final"
    if storage.download_prefix(ctx.bucket, ctx.key("checkpoints", "final") + "/", final_dir) == 0:
        raise RuntimeError("The run has no final weights; training didn't finish")
    data_manifest = storage.read_json(ctx.bucket, ctx.key("data", "manifest.json"))
    vocab = storage.read_json(ctx.bucket, ctx.key("data", "vocab.json"))
    metrics = storage.read_json(ctx.bucket, ctx.key("metrics.json")) or {}
    num_cards = data_manifest["numCards"]
    if len(vocab) != num_cards:
        raise RuntimeError(f"vocab.json has {len(vocab)} cards, the data manifest {num_cards}")

    model = CubeCobraMLSystem(num_cards)
    model.build_submodels()
    model.load_checkpoint(final_dir)

    bundle = ctx.work_dir / "bundle"
    saved = ctx.work_dir / "saved_model"
    shutil.rmtree(bundle, ignore_errors=True)
    shutil.rmtree(saved, ignore_errors=True)
    bundle.mkdir(parents=True)

    for name in PRODUCTION_MODELS:
        getattr(model, name).save(str(saved / name))
        subprocess.run(
            [TFJS_CONVERTER, "--input_format=tf_saved_model", str(saved / name), str(bundle / name)],
            check=True,
        )
        print(f"Converted {name}", flush=True)

    (bundle / "indexToOracleMap.json").write_text(json.dumps({str(i): oracle for i, oracle in enumerate(vocab)}))

    test_cubes = ctx.work_dir / "parity-cubes.json"
    storage.download_file(ctx.bucket, ctx.key("data", "test", "cubes", "0000.json"), test_cubes)
    (bundle / "parity.json").write_text(json.dumps(parity_reference(model, json.loads(test_cubes.read_text()))))

    manifest = {
        "version": ctx.run_id,
        "runId": ctx.run_id,
        "createdAt": int(time.time() * 1000),
        "numCards": num_cards,
        "exportedAt": data_manifest["exportedAt"],
        "dataWindow": {"years": data_manifest["windowYears"], "start": data_manifest["windowStart"]},
        "trainingParams": metrics.get("params", {}),
        "code": {
            "gitSha": os.environ.get("GIT_SHA"),
            "imageDigest": metrics.get("params", {}).get("imageDigest"),
        },
        "libraries": {"tensorflow": tf.__version__, "tensorflowjs": tfjs_version(), "python": platform.python_version()},
        "models": list(PRODUCTION_MODELS),
    }
    (bundle / "manifest.json").write_text(json.dumps(manifest, indent=2))

    count = storage.upload_dir(bundle, ctx.bucket, ctx.key("bundle") + "/")
    print(f"Uploaded {count} bundle files to s3://{ctx.bucket}/{ctx.key('bundle')}/", flush=True)


if __name__ == "__main__":
    main()
