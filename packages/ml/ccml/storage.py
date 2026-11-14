"""S3 helpers for the training and packaging tasks."""

import json
import time
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


def read_json_with_etag(bucket: str, key: str):
    """(parsed object, ETag), or (None, None) when the key doesn't exist."""
    try:
        response = _s3.get_object(Bucket=bucket, Key=key)
    except ClientError as error:
        if _missing(error):
            return None, None
        raise
    return json.loads(response["Body"].read()), response["ETag"]


def write_json_if_unchanged(bucket: str, key: str, data, etag: str | None) -> bool:
    """Writes only if the object still has `etag` (or, with None, still doesn't exist). False when
    something else wrote it first."""
    condition = {"IfMatch": etag} if etag else {"IfNoneMatch": "*"}
    try:
        _s3.put_object(
            Bucket=bucket, Key=key, Body=json.dumps(data).encode(), ContentType="application/json", **condition
        )
    except ClientError as error:
        if error.response.get("Error", {}).get("Code") in ("PreconditionFailed", "ConditionalRequestConflict"):
            return False
        raise
    return True


def download_file(bucket: str, key: str, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    _s3.download_file(bucket, key, str(path))


# Seconds between progress lines for long downloads and loops.
PROGRESS_SECONDS = 10


def download_prefix(bucket: str, prefix: str, local_dir: Path) -> int:
    """Downloads every key under prefix, skipping files already present with the same size."""
    objects = [
        obj
        for page in _s3.get_paginator("list_objects_v2").paginate(Bucket=bucket, Prefix=prefix)
        for obj in page.get("Contents", [])
        if not obj["Key"].endswith("/")
    ]
    total = sum(obj["Size"] for obj in objects)
    print(f"Downloading s3://{bucket}/{prefix}: {len(objects)} files, {total / 2**20:,.0f} MB", flush=True)
    done = fetched = skipped = 0
    last = time.monotonic()
    for i, obj in enumerate(objects, 1):
        target = local_dir / obj["Key"][len(prefix):]
        if target.exists() and target.stat().st_size == obj["Size"]:
            skipped += 1
        else:
            download_file(bucket, obj["Key"], target)
            fetched += 1
        done += obj["Size"]
        if time.monotonic() - last >= PROGRESS_SECONDS or i == len(objects):
            last = time.monotonic()
            print(
                f"  {i}/{len(objects)} files, {done / 2**20:,.0f} of {total / 2**20:,.0f} MB "
                f"({fetched} downloaded, {skipped} already here)",
                flush=True,
            )
    return len(objects)


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
