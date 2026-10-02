import os
import datetime
from typing import Optional
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Depends
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

# Initialize Gemini client once at startup
client = genai.Client(api_key=api_key)

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
}

# Health check endpoint
@app.get("/")
def read_root():
    return {"message": "BizSaathi backend is running with Database & Auth support"}

# Helper function to invoke Gemini model with fallback
def call_gemini(prompt: str) -> str:
    config = types.GenerateContentConfig(
        system_instruction=SYSTEM_INSTRUCTION,
        temperature=0.7,
    )
    last_error = None
    for model in ["gemini-3.5-flash", "gemini-3.8-flash", "gemini-3.5-flash-lite"]:
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
            continue

    raise last_error or Exception("No response generated from Gemini API.")

# Core Chat endpoint: supports authenticated user persistence + guest preview
@app.post("/chat", response_model=schemas.ChatResponse)
@app.post("/api/chat", response_model=schemas.ChatResponse)
def chat_endpoint(
    request: schemas.ChatRequest,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_optional_user)
):
    user_message = request.message.strip()
    if not user_message:
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    selected_lang_name = LANGUAGE_MAP.get(request.language.lower(), request.language)

    # 1. Determine Business Context (use DB profile if authenticated and not overridden)
    b_type = None
    b_budget = None
    b_location = None
    b_goal = None

    conv = None
    if current_user:
        # Fetch DB profile
        db_profile = db.query(models.BusinessProfile).filter(
            models.BusinessProfile.user_id == current_user.id
        ).first()

        if db_profile:
            b_type = request.business_type or db_profile.business_type
            b_budget = request.budget or db_profile.budget
            b_location = request.location or db_profile.location
            b_goal = request.goal or db_profile.goal
        else:
            b_type = request.business_type
            b_budget = request.budget
            b_location = request.location
            b_goal = request.goal

        # 2. Get or create conversation container for the user
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
            db.commit()
            db.refresh(conv)
        elif conv.title in (None, "", "General Advice", "Saved Journey", "New Conversation"):
            title = generate_conversation_title(user_message)
            if title and title != "General Advice":
                conv.title = title
                conv.updated_at = datetime.datetime.utcnow()

        # 3. Save user message to database
        db_user_msg = models.Message(
            conversation_id=conv.id,
            role="user",
            content=user_message,
            language=request.language
        )
        db.add(db_user_msg)
        db.commit()

        # 4. Fetch prior messages from this conversation for context continuity (last 8 turns)
        history_msgs = (
            db.query(models.Message)
            .filter(
                models.Message.conversation_id == conv.id,
                models.Message.id != db_user_msg.id
            )
            .order_by(models.Message.created_at.desc())
            .limit(8)
            .all()
        )
        history_msgs.reverse()
    else:
        b_type = request.business_type
        b_budget = request.budget
        b_location = request.location
        b_goal = request.goal

    # Format fallback text for missing context fields
    str_type = b_type.strip() if b_type and b_type.strip() else "Not specified"
    str_budget = b_budget.strip() if b_budget and b_budget.strip() else "Not specified"
    str_location = b_location.strip() if b_location and b_location.strip() else "Not specified"
    str_goal = b_goal.strip() if b_goal and b_goal.strip() else "Not specified"

    # Assemble prior conversation history
    history_text = ""
    if current_user and conv and history_msgs:
        history_text = "\n".join([f"{'User' if m.role == 'user' else 'BizSaathi'}: {m.content}" for m in history_msgs])
    elif not current_user and request.recent_history:
        history_text = "\n".join([f"{'User' if m.role == 'user' else 'BizSaathi'}: {m.content}" for m in request.recent_history[-8:]])

    # Structure prompt with context, history, and user question
    prompt_parts = [
        f"[User's Selected Response Language: {selected_lang_name} ({request.language})]",
        f"Business Context:\n- Business Type: {str_type}\n- Budget: {str_budget}\n- Location: {str_location}\n- Goal: {str_goal}"
    ]
    if history_text:
        prompt_parts.append(f"Previous Conversation Context:\n{history_text}")
    prompt_parts.append(f"User Question:\n{user_message}")

    prompt = "\n\n".join(prompt_parts)

    try:
        reply_text = call_gemini(prompt)

        # 4. If authenticated, save assistant response to the conversation
        if current_user and conv:
            db_assistant_msg = models.Message(
                conversation_id=conv.id,
                role="assistant",
                content=reply_text,
                language=request.language
            )
            conv.updated_at = datetime.datetime.utcnow()
            db.add(db_assistant_msg)
            db.commit()

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
