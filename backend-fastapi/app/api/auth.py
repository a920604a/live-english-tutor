import app.firebase_app  # noqa: F401 — ensure Firebase Admin SDK is initialized

from firebase_admin import auth as firebase_auth
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.user import User
from app.schemas.auth import FirebaseVerifyRequest, UserOut

router = APIRouter()


@router.post("/verify", response_model=UserOut, status_code=status.HTTP_200_OK)
def verify_firebase_token(
    body: FirebaseVerifyRequest,
    db: Session = Depends(get_db),
) -> UserOut:
    """
    Receive a Firebase ID token from the frontend, verify it server-side,
    then upsert the user in our DB and return the user record.

    Upsert priority:
      1. Exact match on firebase_uid  (returning user, normal path)
      2. Match on email               (legacy account migration)
      3. Create new user              (first sign-in)
    """
    try:
        decoded = firebase_auth.verify_id_token(body.id_token)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Firebase token: {exc}",
        )

    uid: str = decoded["uid"]
    email: str = decoded.get("email", "")
    full_name: str | None = decoded.get("name")

    user = db.query(User).filter(User.firebase_uid == uid).first()

    if user is None:
        # Try to find a legacy account by email and link it
        user = db.query(User).filter(User.email == email).first()
        if user:
            user.firebase_uid = uid
        else:
            user = User(firebase_uid=uid, email=email, full_name=full_name)
            db.add(user)

    db.commit()
    db.refresh(user)
    return user  # type: ignore[return-value]
