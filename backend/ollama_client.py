import json
import os
from typing import AsyncIterator

import httpx

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")


async def get_models() -> list[dict]:
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
        response.raise_for_status()
        return response.json().get("models", [])


async def stream_chat(
    model: str,
    messages: list[dict],
    system_prompt: str = "",
) -> AsyncIterator[str]:
    payload: dict = {"model": model, "messages": messages, "stream": True}
    if system_prompt:
        payload["system"] = system_prompt

    async with httpx.AsyncClient(timeout=None) as client:
        async with client.stream(
            "POST",
            f"{OLLAMA_BASE_URL}/api/chat",
            json=payload,
        ) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if not line:
                    continue
                try:
                    data = json.loads(line)
                    if data.get("done"):
                        break
                    token = data.get("message", {}).get("content", "")
                    if token:
                        yield token
                except json.JSONDecodeError:
                    continue
