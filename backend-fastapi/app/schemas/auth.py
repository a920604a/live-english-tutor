from pydantic import BaseModel


class FirebaseVerifyRequest(BaseModel):
    id_token: str


class UserOut(BaseModel):
    id: int
    email: str
    full_name: str | None
    firebase_uid: str

    model_config = {"from_attributes": True}
