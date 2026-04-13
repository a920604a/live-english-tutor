"""
Firebase Admin SDK initializer.

Imported once at startup (via app/main.py) so that firebase_admin.initialize_app()
is only called a single time for the process lifetime.

Configuration (pick one):
  FIREBASE_SERVICE_ACCOUNT_JSON  — full service-account JSON as a single-line string
  FIREBASE_SERVICE_ACCOUNT_PATH  — local path to the service-account .json file
"""
import json
import os

import firebase_admin
from firebase_admin import credentials


def _initialize() -> firebase_admin.App:
    sa_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON", "").strip()
    if sa_json:
        sa_dict = json.loads(sa_json)
        cred = credentials.Certificate(sa_dict)
        return firebase_admin.initialize_app(cred)

    sa_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "").strip()
    if sa_path:
        cred = credentials.Certificate(sa_path)
        return firebase_admin.initialize_app(cred)

    raise RuntimeError(
        "Firebase Admin SDK not configured. "
        "Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH."
    )


firebase_app = _initialize()
