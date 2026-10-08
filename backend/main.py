import os
import time
import json
import datetime
from typing import Optional
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Depends
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from google import genai
from google.genai import types
from database import get_db, init_db
import models
import schemas
from auth import get_optional_user
from routers import auth as auth_router
from routers import profile as profile_router
from routers import conversations as conversations_router
from routers.conversations import generate_conversation_title

# Load environment variables from backend/.env
load_dotenv()

# Initialize tables
init_db()

api_key = os.getenv("GEMINI_API_KEY") or os.getenv("gemini_api_key")
if not api_key:
    raise ValueError("GEMINI_API_KEY environment variable is not set in backend/.env")

# Initialize Gemini client once at startup with a 25-second timeout
client = genai.Client(
    api_key=api_key,
    http_options=types.HttpOptions(timeout=25000)
)

# Initialize the FastAPI application
app = FastAPI(title="BizSaathi Backend", version="2.0.0")

# Enable CORS for React frontend (configurable for production via CORS_ORIGINS env var)
cors_origins_env = os.getenv("CORS_ORIGINS")
if cors_origins_env:
    allow_origins = [origin.strip() for origin in cors_origins_env.split(",") if origin.strip()]
else:
    allow_origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Authentication routes (/api/auth and /auth)
app.include_router(auth_router.router, prefix="/api/auth")
app.include_router(auth_router.router, prefix="/auth")

# Include Business Profile routes (/api/business-profile, /api/profile, /profile)
app.include_router(profile_router.router, prefix="/api/business-profile")
app.include_router(profile_router.router, prefix="/api/profile")
app.include_router(profile_router.router, prefix="/profile")

# Include Conversation routes (/api/conversations and /conversations)
app.include_router(conversations_router.router, prefix="/api/conversations")
app.include_router(conversations_router.router, prefix="/conversations")

# System instruction defining BizSaathi behavior
SYSTEM_INSTRUCTION = """You are BizSaathi, an AI business advisor for first-time and small-business entrepreneurs in India.

Your job is to provide practical, simple, actionable business guidance.

Rules:
- Respond in the user's selected language.
- Keep explanations simple and beginner-friendly.
- Give practical steps instead of vague motivational advice.
- When useful, structure answers using short headings, bullet points, and numbered steps.
- Consider the user's business context when it is provided.
- Ask a clarifying question when important information is missing.
- Do not invent government schemes, prices, suppliers, laws, statistics, or other factual information.
- If information requires official verification, clearly say so.
- Do not overwhelm the user with unnecessarily long answers.
- Do not present estimated prices, costs, fees, legal requirements, or
  government schemes as verified facts.
- Prioritize actionable recommendations that the user can realistically follow.
- If giving an estimate is useful, clearly label it as an example or
  approximate range and advise the user to verify current local costs.

You are BizSaathi, not a generic chatbot."""

# Language mapping for clear prompt guidance
LANGUAGE_MAP = {
    "en": "English",
    "te": "Telugu",
    "hi": "Hindi",
    "ta": "Tamil",
    "kn": "Kannada",
    "mr": "Marathi",
}

# Health check endpoint
@app.get("/")
def read_root():
    return {"message": "BizSaathi backend is running with Database & Auth support"}

# Helper function to get model list prioritizing the fast, high-quota model
def get_model_list() -> list[str]:
    configured = os.getenv("GEMINI_MODEL")
    default_order = ["gemini-3.5-flash-lite", "gemini-flash-lite-latest", "gemini-3.8-flash"]
    if configured:
        return [configured] + [m for m in default_order if m != configured]
    return default_order

# Optimized prompt builder: preserves context while removing token bloat
def build_chat_prompt(
    user_message: str,
    language: str,
    b_type: Optional[str],
    b_budget: Optional[str],
    b_location: Optional[str],
    b_goal: Optional[str],
    history_msgs: list
) -> str:
    selected_lang_name = LANGUAGE_MAP.get(language.lower(), language)
    prompt_parts = [f"[User's Selected Response Language: {selected_lang_name} ({language})]"]

    # Only include business context fields that actually have values
    ctx_fields = []
    if b_type and b_type.strip():
        ctx_fields.append(f"- Business Type: {b_type.strip()}")
    if b_budget and b_budget.strip():
        ctx_fields.append(f"- Budget: {b_budget.strip()}")
    if b_location and b_location.strip():
        ctx_fields.append(f"- Location: {b_location.strip()}")
    if b_goal and b_goal.strip():
        ctx_fields.append(f"- Goal: {b_goal.strip()}")

    if ctx_fields:
        prompt_parts.append("Business Context:\n" + "\n".join(ctx_fields))

    if history_msgs:
        formatted = []
        for m in history_msgs:
            role = getattr(m, "role", None) or (m.get("role") if isinstance(m, dict) else "user")
            content = getattr(m, "content", None) or (m.get("content") if isinstance(m, dict) else "")
            content = (content or "").strip()
            sender = "User" if role == "user" else "BizSaathi"
            # Trim older assistant messages to 400 chars to avoid prompt bloat
            if sender == "BizSaathi" and len(content) > 400:
                content = content[:400] + "..."
            formatted.append(f"{sender}: {content}")
        prompt_parts.append("Previous Conversation Context:\n" + "\n".join(formatted))

    prompt_parts.append(f"User Question:\n{user_message}")
    return "\n\n".join(prompt_parts)

# Helper function to invoke Gemini model with fallback and exponential backoff
def call_gemini(prompt: str) -> str:
    config = types.GenerateContentConfig(
        system_instruction=SYSTEM_INSTRUCTION,
        temperature=0.7,
        max_output_tokens=1024,
    )
    last_error = None
    for model in get_model_list():
        for attempt in range(2):
            try:
                response = client.models.generate_content(
                    model=model,
                    contents=prompt,
                    config=config,
                )
                if response and response.text:
                    return response.text.strip()
            except Exception as err:
                last_error = err
                err_str = str(err)
                code = getattr(err, "code", None)
                # Retry once with backoff only on 429/503 temporary errors
                if (code in (429, 503) or "429" in err_str or "503" in err_str) and attempt == 0:
                    time.sleep(0.5)
                    continue
                break  # On normal errors or 2nd attempt, switch to next fallback model

    raise last_error or Exception("No response generated from Gemini API.")

# Core Chat endpoint: supports authenticated user persistence + guest preview + streaming
@app.post("/chat", response_model=schemas.ChatResponse)
@app.post("/api/chat", response_model=schemas.ChatResponse)
def chat_endpoint(
    request: schemas.ChatRequest,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_optional_user)
):
    _t_request_start = time.time()
    print("[BizSaathi] Request received")

    user_message = request.message.strip()
    if not user_message:
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    # 1. Determine Business Context
    b_type = request.business_type
    b_budget = request.budget
    b_location = request.location
    b_goal = request.goal

    # Only query DB profile if authenticated and ANY context field is missing
    if current_user and not (b_type and b_budget and b_location and b_goal):
        db_profile = db.query(models.BusinessProfile).filter(
            models.BusinessProfile.user_id == current_user.id
        ).first()
        if db_profile:
            b_type = b_type or db_profile.business_type
            b_budget = b_budget or db_profile.budget
            b_location = b_location or db_profile.location
            b_goal = b_goal or db_profile.goal

    # 2. Conversation & History handling
    conv = None
    history_msgs = []
    if current_user:
        if request.conversation_id:
            target_conv = db.query(models.Conversation).filter(
                models.Conversation.id == request.conversation_id
            ).first()
            if target_conv:
                if target_conv.user_id != current_user.id:
                    raise HTTPException(
                        status_code=403,
                        detail="Access denied. You do not own this conversation."
                    )
                conv = target_conv

        if not conv:
            title = generate_conversation_title(user_message)
            conv = models.Conversation(user_id=current_user.id, title=title or "General Advice")
            db.add(conv)
            db.flush()  # Assigns conv.id without a separate disk fsync round-trip
        elif conv.title in (None, "", "General Advice", "Saved Journey", "New Conversation"):
            title = generate_conversation_title(user_message)
            if title and title != "General Advice":
                conv.title = title
                conv.updated_at = datetime.datetime.now(datetime.timezone.utc)

        # Fetch prior messages (last 6 turns)
        history_msgs = (
            db.query(models.Message)
            .filter(models.Message.conversation_id == conv.id)
            .order_by(models.Message.created_at.desc())
            .limit(6)
            .all()
        )
        history_msgs.reverse()

        # Save user message to database in a single commit with conversation
        db_user_msg = models.Message(
            conversation_id=conv.id,
            role="user",
            content=user_message,
            language=request.language
        )
        db.add(db_user_msg)
        db.commit()
    elif request.recent_history:
        history_msgs = request.recent_history[-6:]

    prompt = build_chat_prompt(
        user_message=user_message,
        language=request.language,
        b_type=b_type,
        b_budget=b_budget,
        b_location=b_location,
        b_goal=b_goal,
        history_msgs=history_msgs,
    )

    # 3. If streaming requested: return SSE stream
    if request.stream:
        def stream_generator():
            _t_gemini_start = time.time()
            print("[BizSaathi] Gemini started (streaming)")
            config = types.GenerateContentConfig(
                system_instruction=SYSTEM_INSTRUCTION,
                temperature=0.7,
                max_output_tokens=1024,
            )
            accumulated_chunks = []
            models_to_try = get_model_list()
            stream_started = False

            for model_name in models_to_try:
                try:
                    stream = client.models.generate_content_stream(
                        model=model_name,
                        contents=prompt,
                        config=config,
                    )
                    for chunk in stream:
                        if chunk.text:
                            stream_started = True
                            accumulated_chunks.append(chunk.text)
                            yield f"data: {json.dumps({'chunk': chunk.text})}\n\n"
                    break  # Stream succeeded
                except Exception as err:
                    if stream_started:
                        # Stream failed mid-way, stop cleanly
                        break
                    # If failed before starting, try next fallback model
                    continue

            _t_gemini_elapsed = time.time() - _t_gemini_start
            print(f"[BizSaathi] Gemini response received (streaming): {_t_gemini_elapsed:.2f}s")

            full_reply = "".join(accumulated_chunks).strip()
            conv_id = conv.id if conv else None

            # Persist assistant message upon stream completion
            if current_user and conv and full_reply:
                try:
                    db_assistant_msg = models.Message(
                        conversation_id=conv.id,
                        role="assistant",
                        content=full_reply,
                        language=request.language
                    )
                    conv.updated_at = datetime.datetime.now(datetime.timezone.utc)
                    db.add(db_assistant_msg)
                    db.commit()
                except Exception as save_err:
                    print(f"Error persisting streamed assistant message: {save_err}")
                    db.rollback()

            _t_total_elapsed = time.time() - _t_request_start
            print(f"[BizSaathi] Total request time (streaming): {_t_total_elapsed:.2f}s")
            yield f"data: {json.dumps({'done': True, 'conversation_id': conv_id})}\n\n"

        return StreamingResponse(
            stream_generator(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            }
        )

    # 4. Standard Non-Streaming response (fallback / automated tests)
    try:
        print("[BizSaathi] Gemini started")
        _t_gemini_start = time.time()
        reply_text = call_gemini(prompt)
        _t_gemini_elapsed = time.time() - _t_gemini_start
        print(f"[BizSaathi] Gemini response received: {_t_gemini_elapsed:.2f}s")

        if current_user and conv:
            db_assistant_msg = models.Message(
                conversation_id=conv.id,
                role="assistant",
                content=reply_text,
                language=request.language
            )
            conv.updated_at = datetime.datetime.now(datetime.timezone.utc)
            db.add(db_assistant_msg)
            db.commit()

        _t_total_elapsed = time.time() - _t_request_start
        print(f"[BizSaathi] Total request time: {_t_total_elapsed:.2f}s")
        return schemas.ChatResponse(
            reply=reply_text,
            conversation_id=conv.id if conv else None
        )

    except Exception as e:
        print(f"Error during Gemini generation: {type(e).__name__}: {e}")
        raise HTTPException(
            status_code=500,
            detail="Unable to generate advice right now. Please try again."
        )
