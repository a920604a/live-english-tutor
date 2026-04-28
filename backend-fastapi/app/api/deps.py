import app.firebase_app  # noqa: F401 — ensure Firebase Admin SDK is initialized

from firebase_admin import auth as firebase_auth
from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User


def get_current_user(
    authorization: str = Header(...),
    db: Session = Depends(get_db),
) -> User:
    """
    Dependency that validates a Firebase ID token from the
    `Authorization: Bearer <token>` header and returns the matching DB user.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header must start with 'Bearer '",
        )

    token = authorization[len("Bearer "):]

    try:
        decoded = firebase_auth.verify_id_token(token)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {exc}",
        )

    uid: str = decoded["uid"]
    user = db.query(User).filter(User.firebase_uid == uid).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found — please sign in again",
        )
    return user
