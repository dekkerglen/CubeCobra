"""S3 helpers for the training and packaging tasks."""

import json
from pathlib import Path

import boto3
from botocore.exceptions import ClientError

_s3 = boto3.client("s3")


def _missing(error: ClientError) -> bool:
    return error.response.get("Error", {}).get("Code") in ("NoSuchKey", "404", "NotFound")


def list_keys(bucket: str, prefix: str) -> list[str]:
    keys = []
    for page in _s3.get_paginator("list_objects_v2").paginate(Bucket=bucket, Prefix=prefix):
        keys.extend(obj["Key"] for obj in page.get("Contents", []) if not obj["Key"].endswith("/"))
    return keys


def exists(bucket: str, key: str) -> bool:
    try:
        _s3.head_object(Bucket=bucket, Key=key)
        return True
    except ClientError as error:
        if _missing(error):
            return False
        raise


def read_json(bucket: str, key: str):
    """The parsed object, or None when the key doesn't exist."""
    try:
        body = _s3.get_object(Bucket=bucket, Key=key)["Body"].read()
    except ClientError as error:
        if _missing(error):
            return None
        raise
    return json.loads(body)


def write_json(bucket: str, key: str, data) -> None:
    _s3.put_object(Bucket=bucket, Key=key, Body=json.dumps(data).encode(), ContentType="application/json")


def download_file(bucket: str, key: str, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    _s3.download_file(bucket, key, str(path))


def download_prefix(bucket: str, prefix: str, local_dir: Path) -> int:
    """Downloads every key under prefix, skipping files already present with the same size."""
    count = 0
    for page in _s3.get_paginator("list_objects_v2").paginate(Bucket=bucket, Prefix=prefix):
        for obj in page.get("Contents", []):
            key = obj["Key"]
            if key.endswith("/"):
                continue
            target = local_dir / key[len(prefix):]
            if not (target.exists() and target.stat().st_size == obj["Size"]):
                download_file(bucket, key, target)
            count += 1
    return count


def upload_file(bucket: str, key: str, path: Path) -> None:
    content_type = "application/json" if path.suffix == ".json" else "application/octet-stream"
    _s3.upload_file(str(path), bucket, key, ExtraArgs={"ContentType": content_type})


def upload_dir(local_dir: Path, bucket: str, prefix: str) -> int:
    files = [p for p in local_dir.rglob("*") if p.is_file()]
    for path in files:
        upload_file(bucket, prefix + path.relative_to(local_dir).as_posix(), path)
    return len(files)


def delete_keys(bucket: str, keys: list[str]) -> None:
    for start in range(0, len(keys), 1000):
        batch = keys[start:start + 1000]
        _s3.delete_objects(Bucket=bucket, Delete={"Objects": [{"Key": key} for key in batch]})
