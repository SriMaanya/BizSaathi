import datetime
from typing import Optional, List, Annotated
from pydantic import BaseModel, EmailStr, Field, PlainSerializer

def serialize_utc_datetime(dt: Optional[datetime.datetime]) -> Optional[str]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=datetime.timezone.utc)
    else:
        dt = dt.astimezone(datetime.timezone.utc)
    return dt.isoformat()

UtcDateTime = Annotated[datetime.datetime, PlainSerializer(serialize_utc_datetime, return_type=str, when_used='json')]

# User Schemas
class UserRegister(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=100)
    confirm_password: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    id: int
    name: str
    email: str
    theme: Optional[str] = "light"
    created_at: UtcDateTime
    updated_at: Optional[UtcDateTime] = None

    class Config:
        from_attributes = True

class UserProfileUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    theme: Optional[str] = None

class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=6, max_length=100)
    confirm_new_password: Optional[str] = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut

# Business Profile Schemas
class BusinessProfileBase(BaseModel):
    business_type: Optional[str] = None
    budget: Optional[str] = None
    location: Optional[str] = None
    goal: Optional[str] = None

class BusinessProfileCreate(BusinessProfileBase):
    pass

class BusinessProfileUpdate(BusinessProfileBase):
    pass

class BusinessProfileOut(BusinessProfileBase):
    id: int
    user_id: int
    created_at: UtcDateTime
    updated_at: UtcDateTime

    class Config:
        from_attributes = True

# Message Schemas
class MessageCreate(BaseModel):
    role: str  # "user" or "assistant"
    content: str
    language: str = "en"

class MessageOut(BaseModel):
    id: int
    conversation_id: int
    role: str
    content: str
    language: str
    created_at: UtcDateTime

    class Config:
        from_attributes = True

# Conversation Schemas
class ConversationCreate(BaseModel):
    title: Optional[str] = "General Advice"

class ConversationSummary(BaseModel):
    id: int
    user_id: int
    title: Optional[str] = None
    created_at: UtcDateTime
    updated_at: UtcDateTime
    message_count: int = 0
    last_message: Optional[str] = None

    class Config:
        from_attributes = True

class ConversationOut(BaseModel):
    id: int
    user_id: int
    title: Optional[str] = None
    migration_id: Optional[str] = None
    created_at: UtcDateTime
    updated_at: UtcDateTime
    messages: List[MessageOut] = []

    class Config:
        from_attributes = True

# Guest Conversation Transfer Schema
class ConversationTransferRequest(BaseModel):
    title: Optional[str] = None
    migration_id: Optional[str] = None
    business_context: Optional[BusinessProfileCreate] = None
    messages: List[MessageCreate] = []

# Chat Request & Response
class ChatRequest(BaseModel):
    message: str
    language: str = "en"
    business_type: Optional[str] = None
    budget: Optional[str] = None
    location: Optional[str] = None
    goal: Optional[str] = None
    conversation_id: Optional[int] = None
    recent_history: Optional[List[MessageCreate]] = None

class ChatResponse(BaseModel):
    reply: str
    conversation_id: Optional[int] = None
