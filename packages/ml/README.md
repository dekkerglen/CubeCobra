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

Archetypes are clusters of training decks by the Scryfall oracle tags of their nonland cards
(`ccml/topics.py`): each deck is a TF-IDF tag vector, reduced with truncated SVD and grouped with
k-means into 30 archetypes. Tags that describe no cube strategy are left out: names and wording,
colors, single tribes, rules templating, errata, flavor and other formats (`ccml/tag_denylist.py`).
An archetype's tags are the ones its decks have most beyond decks overall, and Claude on Amazon
Bedrock names it from its top 10 tags alone, in an actor and a critic pass (`ccml/name_topics.py`,
model set by `ML_BEDROCK_MODEL_ID`). Names admins edited on the live version carry over to the new
archetypes with matching top tags. Naming never fails a run: without a model, or on any error,
archetypes keep names built from their top tags, and `archetypes/naming.json` says why.

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

### Revising archetypes and their names

`ccml/review_names.py` builds and names a run's archetypes from your machine, so the clustering in
`ccml/topics.py` and the naming prompts in `ccml/name_topics.py` can be revised and tried without a
retraining run. It uses your AWS credentials and the production pipeline's buckets and Bedrock
settings.

```bash
uv run python -m ccml.review_names topics <run id>    # cluster the run's decks into archetypes and name them
uv run python -m ccml.review_names propose <run id>   # name them again without re-clustering
uv run python -m ccml.review_names show <run id>      # the proposal next to the committed names
uv run python -m ccml.review_names commit <run id>    # list the changes, approve, write them
```

`topics` downloads the run's training data once (about 400 MB), saves the archetypes to
`$ML_WORK_DIR/naming/<run id>.topics.json` (`/tmp/ml` by default) and names them; while that file
exists, `propose` names those archetypes and `commit` replaces the run's archetypes with them. Nothing changes in S3
until `commit` is approved. A proposal is saved to `$ML_WORK_DIR/naming/<run id>.json`; change a
`name` there by hand to override Claude, and the commit marks it edited so later runs carry it over.
A commit writes the run's bundle, which publishing copies, and every published copy of that version.
Servers load archetypes at boot, so changes to the served version show after the next restart.
