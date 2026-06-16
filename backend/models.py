import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from db import Base


class Plan(Base):
    __tablename__ = "plans"

    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True, nullable=False)
    price_cents = Column(Integer, nullable=False, default=0)
    monthly_conversation_limit = Column(Integer, nullable=False, default=500)

    accounts = relationship("Account", back_populates="plan")


class Account(Base):
    __tablename__ = "accounts"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    website_url = Column(String, nullable=False)
    contact_email = Column(String, nullable=True)
    contact_phone = Column(String, nullable=True)

    plan_id = Column(Integer, ForeignKey("plans.id"), nullable=False)
    plan = relationship("Plan", back_populates="accounts")

    api_key_hash = Column(String, unique=True, nullable=False, index=True)

    # pending -> confirmed -> crawling -> ready (falls back to "confirmed" on a crawl error, so it can be retried)
    status = Column(String, nullable=False, default="pending")

    chroma_collection = Column(String, nullable=True)
    system_prompt = Column(Text, nullable=True, default="")
    chunk_count = Column(Integer, nullable=False, default=0)
    contact_info_json = Column(Text, nullable=True, default="{}")
    monthly_chat_count = Column(Integer, nullable=False, default=0)

    created_at = Column(DateTime, default=datetime.datetime.utcnow)
