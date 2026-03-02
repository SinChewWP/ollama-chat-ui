from datetime import datetime
from typing import Optional, List

from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from pydantic import BaseModel

from database import Base


# ── SQLAlchemy ORM models ─────────────────────────────────────────────────────

class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), default="New Chat")
    model = Column(String(100), default="llama3")
    system_prompt = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    messages = relationship(
        "Message",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="Message.created_at",
    )


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False)
    role = Column(String(20), nullable=False)   # "user" | "assistant"
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    conversation = relationship("Conversation", back_populates="messages")


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class MessageSchema(BaseModel):
    id: int
    role: str
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ConversationSchema(BaseModel):
    id: int
    title: str
    model: str
    system_prompt: str
    created_at: datetime
    updated_at: datetime
    messages: List[MessageSchema] = []

    model_config = {"from_attributes": True}


class ConversationListSchema(BaseModel):
    id: int
    title: str
    model: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CreateConversationRequest(BaseModel):
    title: str = "New Chat"
    model: str = "llama3"
    system_prompt: str = ""


class UpdateConversationRequest(BaseModel):
    title: Optional[str] = None
    model: Optional[str] = None
    system_prompt: Optional[str] = None


class SendMessageRequest(BaseModel):
    content: str
    model: str
