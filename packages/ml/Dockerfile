# Training image for the ML retraining pipeline: runs `python -m ccml.train` and
# `python -m ccml.package` as ECS tasks on the GPU capacity provider (packages/cdk/lib/ml-pipeline.ts).
# Built from the repository root like the jobs image:
#   docker build -f packages/ml/Dockerfile --build-arg GIT_SHA=$(git rev-parse HEAD) .
#
# The base comes from AWS's public ECR mirror of Docker Hub library images so CodeBuild isn't
# rate-limited. CUDA and cuDNN come from the tensorflow[and-cuda] wheels; the host's NVIDIA driver
# comes from the ECS GPU-optimized AMI.
FROM public.ecr.aws/docker/library/python:3.11-slim

ARG GIT_SHA=unknown
ENV GIT_SHA=${GIT_SHA} \
    TF_USE_LEGACY_KERAS=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    ML_WORK_DIR=/work

WORKDIR /app

# Training dependencies, exactly as locked.
RUN pip install uv==0.12.21
COPY packages/ml/pyproject.toml packages/ml/uv.lock ./
RUN uv export --frozen --no-dev --no-hashes --no-emit-project -o requirements.txt \
    && uv pip install --system -r requirements.txt \
    && rm requirements.txt

# tensorflowjs pins its own TensorFlow and an older protobuf than training uses, so the converter gets
# its own virtualenv. These pins are the combination known to convert this model (tensorflow
# decision forests 1.11 was rebuilt against protobuf 6 and breaks the converter).
RUN python -m venv /opt/tfjs \
    && /opt/tfjs/bin/pip install 'tensorflowjs==4.22.0' 'tensorflow_decision_forests==1.10.0' 'setuptools<70'

COPY packages/ml/ccml ./ccml
COPY packages/ml/train-config.json ./

RUN useradd --create-home ml && mkdir -p /work && chown ml /work
USER ml

CMD ["python", "-m", "ccml.train"]
