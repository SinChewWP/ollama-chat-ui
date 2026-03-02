import json
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

import ollama_client
from database import async_session, get_db, init_db
from models import (
    Conversation,
    ConversationListSchema,
    ConversationSchema,
    CreateConversationRequest,
    Message,
    SendMessageRequest,
    UpdateConversationRequest,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="Ollama Chat API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Models ────────────────────────────────────────────────────────────────────

@app.get("/api/models")
async def list_models():
    try:
        models = await ollama_client.get_models()
        return {"models": models}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Cannot connect to Ollama: {e}")


# ── Conversations ─────────────────────────────────────────────────────────────

@app.get("/api/conversations", response_model=list[ConversationListSchema])
async def list_conversations(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Conversation).order_by(desc(Conversation.updated_at))
    )
    return result.scalars().all()


@app.post("/api/conversations", response_model=ConversationSchema)
async def create_conversation(
    request: CreateConversationRequest,
    db: AsyncSession = Depends(get_db),
):
    conv = Conversation(
        title=request.title,
        model=request.model,
        system_prompt=request.system_prompt,
    )
    db.add(conv)
    await db.commit()
    await db.refresh(conv)
    return conv


@app.get("/api/conversations/{conv_id}", response_model=ConversationSchema)
async def get_conversation(conv_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Conversation).where(Conversation.id == conv_id))
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv


@app.patch("/api/conversations/{conv_id}", response_model=ConversationSchema)
async def update_conversation(
    conv_id: int,
    request: UpdateConversationRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Conversation).where(Conversation.id == conv_id))
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if request.title is not None:
        conv.title = request.title
    if request.model is not None:
        conv.model = request.model
    if request.system_prompt is not None:
        conv.system_prompt = request.system_prompt

    await db.commit()
    await db.refresh(conv)
    return conv


@app.delete("/api/conversations/{conv_id}")
async def delete_conversation(conv_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Conversation).where(Conversation.id == conv_id))
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    await db.delete(conv)
    await db.commit()
    return {"ok": True}


# ── Messages / streaming ──────────────────────────────────────────────────────

@app.post("/api/conversations/{conv_id}/messages")
async def send_message(
    conv_id: int,
    request: SendMessageRequest,
    db: AsyncSession = Depends(get_db),
):
    # Fetch conversation
    result = await db.execute(select(Conversation).where(Conversation.id == conv_id))
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Save user message
    user_msg = Message(conversation_id=conv_id, role="user", content=request.content)
    db.add(user_msg)
    conv.model = request.model
    await db.commit()

    # Build full message history for Ollama
    msg_result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conv_id)
        .order_by(Message.created_at)
    )
    history = [{"role": m.role, "content": m.content} for m in msg_result.scalars()]
    system_prompt = conv.system_prompt or ""
    is_first_exchange = len(history) == 1   # only the user message we just saved

    async def generate():
        full_response = ""
        try:
            async for token in ollama_client.stream_chat(
                model=request.model,
                messages=history,
                system_prompt=system_prompt,
            ):
                full_response += token
                yield f"data: {json.dumps({'token': token})}\n\n"

            # Persist the assistant reply in its own session to avoid conflicts
            async with async_session() as new_db:
                assistant_msg = Message(
                    conversation_id=conv_id,
                    role="assistant",
                    content=full_response,
                )
                new_db.add(assistant_msg)

                # Auto-title on first exchange
                if is_first_exchange:
                    words = request.content.split()[:6]
                    title = " ".join(words) + ("…" if len(words) >= 6 else "")
                    conv_row = await new_db.get(Conversation, conv_id)
                    if conv_row and conv_row.title == "New Chat":
                        conv_row.title = title

                await new_db.commit()
                await new_db.refresh(assistant_msg)

            yield f"data: {json.dumps({'done': True, 'message_id': assistant_msg.id})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
