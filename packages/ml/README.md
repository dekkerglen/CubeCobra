# ccml

Training code for the CubeCobra recommender model: one shared card-set encoder with decoders for
cube recommendations, deck building and draft picks. It runs as part of the ML retraining pipeline
(a Step Functions state machine in `packages/cdk/lib/ml-pipeline.ts`) after each 90-day data export.

| Stage                                    | Where               | Command                                                                   |
| ---------------------------------------- | ------------------- | ------------------------------------------------------------------------- |
| Process data                             | jobs image, Fargate | `npm run ml-process-data` (`packages/jobs/src/ml/processTrainingData.ts`) |
| Train                                    | this image, GPU     | `python -m ccml.train`                                                    |
| Package                                  | this image, GPU     | `python -m ccml.package`                                                  |
| Archetypes (alongside Train and Package) | this image, Fargate | `python -m ccml.topics`                                                   |
| Evaluate (gate)                          | jobs image, Fargate | `npm run ml-evaluate`                                                     |
| Publish                                  | jobs image, Fargate | `npm run ml-publish`                                                      |

Every stage reads and writes `s3://<ML_RUNS_BUCKET>/ml/runs/<ML_RUN_ID>/`; the layout is documented
in `packages/utils/src/ml/modelBundle.ts`. Hyperparameters live in `train-config.json`.

Training uses drafts from the 3 years before the export and cubes updated in that window, with a
stable 5% test split by cube or draft id. Each run's `metrics.json` holds its parameters, per-epoch
losses, and the gate metrics on the train and test splits every 10 epochs; the admin page at
`/admin/mlretraining` shows them.

Archetypes are NMF topics over the Scryfall oracle tags of the training decks' nonland cards
(`ccml/topics.py`), named by Claude on Amazon Bedrock in an actor and a critic pass
(`ccml/name_topics.py`, model set by `ML_BEDROCK_MODEL_ID`). Names admins edited on the live version
carry over to the new topics with matching top tags. Naming never fails a run: without a model, or
on any error, topics keep names built from their top tags, and `archetypes/naming.json` says why.

The gate metrics are defined in `ccml/metrics.py` and `packages/jobs/src/ml/gateMetrics.ts`, which
must stay identical; `tests/test_metrics.py` and `gateMetrics.test.ts` share their cases.

## Local development

```bash
uv sync
uv run pytest
```

Running a stage locally needs AWS credentials for the runs bucket:

```bash
ML_RUN_ID=<run id> ML_RUNS_BUCKET=<bucket> ML_WORK_DIR=/tmp/ml uv run python -m ccml.train
```

`ccml.package` also needs the TF.js converter, which conflicts with training's TensorFlow pins and is
installed in its own virtualenv; see the Dockerfile and set `TFJS_CONVERTER` / `TFJS_PYTHON`.
