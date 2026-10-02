import re
import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload
from database import get_db
import models
import schemas
from auth import get_current_user

router = APIRouter(tags=["Conversations"])

def generate_conversation_title(first_message: str) -> str:
    """Generates a concise, meaningful title from the initial user query."""
    if not first_message:
        return "General Advice"
    
    text = first_message.strip().split("\n")[0].strip()
    lower = text.lower()
    clean_lower = re.sub(r'[^\w\s]', ' ', lower).strip()
    clean_lower = re.sub(r'\s+', ' ', clean_lower)
    
    # Specific patterns matching entrepreneur queries
    patterns = [
        (r"^i want to start an?\s+(?:small\s+)?([a-zA-Z\s]+?)(?:\s+(?:with|in|for|at|using)\b.*|$)", r"Starting a \1"),
        (r"^how (?:do i|can i|to) start an?\s+(?:small\s+)?([a-zA-Z\s]+?)(?:\s+(?:with|in|for|at|using)\b.*|$)", r"Starting a \1"),
        (r"^i need help marketing (?:my\s+)?([a-zA-Z\s]+?)(?:\s+(?:in|for|with)\b.*|$)", r"\1 Marketing"),
        (r"^how to market (?:my\s+)?([a-zA-Z\s]+?)(?:\s+(?:in|for|with)\b.*|$)", r"\1 Marketing"),
        (r"^i need help with\s+([a-zA-Z\s]+?)(?:\s+(?:in|for)\b.*|$)", r"\1 Help"),
        (r"^business cost planning\b.*", r"Business Cost Planning"),
        (r"^how to reduce (?:costs|expenses)\b.*", r"Cost Reduction"),
        (r"^how do i find (?:my )?first customers\b.*", r"Finding First Customers"),
    ]
    
    for pat, repl in patterns:
        m = re.match(pat, clean_lower)
        if m:
            title = re.sub(pat, repl, clean_lower).strip()
            return " ".join(w.capitalize() for w in title.split())[:35]
            
    # For multilingual or other phrasing: clean up and trim to max 35 chars
    cleaned = re.sub(r'[^\w\s\u0900-\u0D7F₹]', '', text)
    if len(cleaned) > 35:
        cut = cleaned[:35]
        last_space = cut.rfind(' ')
        if last_space > 18:
            return cut[:last_space].strip() + "..."
        return cut.strip() + "..."
    return cleaned or "Business Advice"

@router.get("", response_model=List[schemas.ConversationOut])
def list_conversations(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Returns all conversations for the authenticated user, ordered by most recently updated."""
    conversations = (
        db.query(models.Conversation)
        .options(selectinload(models.Conversation.messages))
        .filter(models.Conversation.user_id == current_user.id)
        .order_by(models.Conversation.updated_at.desc())
        .all()
    )
    return conversations

@router.post("", response_model=schemas.ConversationOut, status_code=status.HTTP_201_CREATED)
def create_conversation(
    conv_in: Optional[schemas.ConversationCreate] = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Creates a new conversation container for the authenticated user."""
    title = conv_in.title if conv_in and conv_in.title else "General Advice"
    conversation = models.Conversation(user_id=current_user.id, title=title)
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return conversation

@router.post("/transfer", response_model=schemas.ConversationOut, status_code=status.HTTP_201_CREATED)
@router.post("/migrate-guest", response_model=schemas.ConversationOut, status_code=status.HTTP_201_CREATED)
def transfer_guest_data(
    payload: schemas.ConversationTransferRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Transfers guest conversation messages and optional business context
    into the authenticated user's account in PostgreSQL without data loss or duplication.
    """
    # 1. Transfer Business Context if provided and not already configured
    if payload.business_context:
        bc = payload.business_context
        profile = db.query(models.BusinessProfile).filter(models.BusinessProfile.user_id == current_user.id).first()
        if not profile:
            profile = models.BusinessProfile(
                user_id=current_user.id,
                business_type=bc.business_type,
                budget=bc.budget,
                location=bc.location,
                goal=bc.goal
            )
            db.add(profile)
            db.commit()
        else:
            # Fill in any missing profile fields from guest context (do NOT overwrite existing user profile)
            updated = False
            if bc.business_type and not profile.business_type:
                profile.business_type = bc.business_type
                updated = True
            if bc.budget and not profile.budget:
                profile.budget = bc.budget
                updated = True
            if bc.location and not profile.location:
                profile.location = bc.location
                updated = True
            if bc.goal and not profile.goal:
                profile.goal = bc.goal
                updated = True
            if updated:
                profile.updated_at = datetime.datetime.utcnow()
                db.commit()

    # 2. Check if this guest conversation was ALREADY migrated (deduplication / idempotency protection)
    if payload.migration_id:
        existing_by_migration = (
            db.query(models.Conversation)
            .filter(
                models.Conversation.user_id == current_user.id,
                models.Conversation.migration_id == payload.migration_id
            )
            .first()
        )
        if existing_by_migration:
            return existing_by_migration

    if payload.messages:
        existing_convs = (
            db.query(models.Conversation)
            .filter(models.Conversation.user_id == current_user.id)
            .order_by(models.Conversation.updated_at.desc())
            .all()
        )
        for existing in existing_convs:
            if existing.messages and len(existing.messages) >= len(payload.messages):
                if (existing.messages[0].content == payload.messages[0].content and
                    existing.messages[len(payload.messages) - 1].content == payload.messages[-1].content):
                    return existing

    # 3. Determine title from first user message if available
    title = payload.title
    if not title and payload.messages:
        first_user_msg = next((m for m in payload.messages if m.role == "user"), None)
        if first_user_msg and first_user_msg.content:
            title = generate_conversation_title(first_user_msg.content)
    if not title:
        title = "Saved Journey"

    # 4. Create conversation container
    conv = models.Conversation(
        user_id=current_user.id,
        title=title,
        migration_id=payload.migration_id
    )
    db.add(conv)
    db.commit()
    db.refresh(conv)

    # 5. Insert all messages into the conversation
    if payload.messages:
        for msg in payload.messages:
            db_msg = models.Message(
                conversation_id=conv.id,
                role=msg.role,
                content=msg.content,
                language=msg.language or "en"
            )
            db.add(db_msg)
        conv.updated_at = datetime.datetime.utcnow()
        db.commit()
        db.refresh(conv)

    return conv

@router.get("/{conversation_id}", response_model=schemas.ConversationOut)
def get_conversation(
    conversation_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieves a single conversation with its messages.
    Enforces authorization: users can ONLY access their own conversations.
    Returns 404 if not found, 403 Forbidden if owned by another user.
    """
    conversation = (
        db.query(models.Conversation)
        .options(selectinload(models.Conversation.messages))
        .filter(models.Conversation.id == conversation_id)
        .first()
    )
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found."
        )

    if conversation.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You do not have permission to view this conversation."
        )

    return conversation

@router.post("/{conversation_id}/messages", response_model=schemas.MessageOut, status_code=status.HTTP_201_CREATED)
def add_message_to_conversation(
    conversation_id: int,
    msg_in: schemas.MessageCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Adds a message directly to an existing conversation belonging to the authenticated user."""
    conversation = (
        db.query(models.Conversation)
        .filter(models.Conversation.id == conversation_id)
        .first()
    )
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found."
        )

    if conversation.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You do not own this conversation."
        )

    msg = models.Message(
        conversation_id=conversation.id,
        role=msg_in.role,
        content=msg_in.content,
        language=msg_in.language
    )
    conversation.updated_at = datetime.datetime.utcnow()
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg

@router.delete("/{conversation_id}", status_code=status.HTTP_200_OK)
def delete_conversation(
    conversation_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Deletes a conversation and its messages.
    Enforces authorization: users can ONLY delete their own conversations.
    Returns 404 if not found, 403 Forbidden if owned by another user.
    """
    conversation = (
        db.query(models.Conversation)
        .filter(models.Conversation.id == conversation_id)
        .first()
    )
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found."
        )

    if conversation.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You do not have permission to delete this conversation."
        )

    try:
        # Explicitly delete associated messages first to guarantee zero orphaned records
        db.query(models.Message).filter(models.Message.conversation_id == conversation.id).delete(synchronize_session=False)
        db.delete(conversation)
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to delete the conversation right now."
        )
    return {"message": "Conversation deleted successfully."}
