import hashlib
import secrets

from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from db import get_db
from models import Account


def generate_api_key() -> str:
    return secrets.token_urlsafe(32)


def hash_api_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()


def get_current_account(
    x_api_key: str = Header(..., alias="X-API-Key"),
    db: Session = Depends(get_db),
) -> Account:
    """Resolve the calling Account from the X-API-Key header.

    Only checks the key is valid — callers that need the account to be
    fully crawled ("ready") check `account.status` themselves, so this
    dependency can also back read-only status polling pre-ready.
    """
    account = db.query(Account).filter(Account.api_key_hash == hash_api_key(x_api_key)).first()
    if not account:
        raise HTTPException(status_code=401, detail="Invalid API key.")
    return account
