import logging
from io import BytesIO

import boto3
from botocore.client import Config

from app.config import settings

logger = logging.getLogger(__name__)


def _client():
    return boto3.client(
        "s3",
        endpoint_url=settings.R2_ENDPOINT_URL,
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        config=Config(signature_version="s3v4"),
        region_name="auto",
    )


def upload_pdf(file_bytes: bytes, r2_key: str) -> None:
    """Upload PDF bytes to R2."""
    client = _client()
    client.put_object(
        Bucket=settings.R2_BUCKET_NAME,
        Key=r2_key,
        Body=file_bytes,
        ContentType="application/pdf",
    )
    logger.info("R2 upload: %s (%d bytes)", r2_key, len(file_bytes))


def download_pdf(r2_key: str) -> bytes:
    """Download PDF bytes from R2."""
    client = _client()
    response = client.get_object(Bucket=settings.R2_BUCKET_NAME, Key=r2_key)
    data = response["Body"].read()
    logger.info("R2 download: %s (%d bytes)", r2_key, len(data))
    return data


def delete_object(r2_key: str) -> None:
    """Delete object from R2."""
    client = _client()
    client.delete_object(Bucket=settings.R2_BUCKET_NAME, Key=r2_key)
    logger.info("R2 delete: %s", r2_key)
