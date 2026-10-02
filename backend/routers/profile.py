import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
import models
import schemas
from auth import get_current_user

router = APIRouter(tags=["Business Profile"])

@router.get("", response_model=Optional[schemas.BusinessProfileOut])
def get_business_profile(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Fetches the active business profile for the authenticated user."""
    profile = db.query(models.BusinessProfile).filter(
        models.BusinessProfile.user_id == current_user.id
    ).first()
    return profile

@router.post("", response_model=schemas.BusinessProfileOut, status_code=status.HTTP_201_CREATED)
def create_or_upsert_business_profile(
    profile_in: schemas.BusinessProfileCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Creates or updates the business profile for the authenticated user.
    Enforces that one user has one active business profile.
    """
    profile = db.query(models.BusinessProfile).filter(
        models.BusinessProfile.user_id == current_user.id
    ).first()

    if profile:
        profile.business_type = profile_in.business_type
        profile.budget = profile_in.budget
        profile.location = profile_in.location
        profile.goal = profile_in.goal
        profile.updated_at = datetime.datetime.utcnow()
    else:
        profile = models.BusinessProfile(
            user_id=current_user.id,
            business_type=profile_in.business_type,
            budget=profile_in.budget,
            location=profile_in.location,
            goal=profile_in.goal,
        )
        db.add(profile)

    db.commit()
    db.refresh(profile)
    return profile

@router.put("", response_model=schemas.BusinessProfileOut)
@router.put("/business", response_model=schemas.BusinessProfileOut)
def update_business_profile(
    profile_in: schemas.BusinessProfileUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Updates fields on the authenticated user's business profile."""
    profile = db.query(models.BusinessProfile).filter(
        models.BusinessProfile.user_id == current_user.id
    ).first()

    if not profile:
        # If no profile exists yet, create one
        profile = models.BusinessProfile(
            user_id=current_user.id,
            business_type=profile_in.business_type,
            budget=profile_in.budget,
            location=profile_in.location,
            goal=profile_in.goal,
        )
        db.add(profile)
    else:
        if profile_in.business_type is not None:
            profile.business_type = profile_in.business_type
        if profile_in.budget is not None:
            profile.budget = profile_in.budget
        if profile_in.location is not None:
            profile.location = profile_in.location
        if profile_in.goal is not None:
            profile.goal = profile_in.goal
        profile.updated_at = datetime.datetime.utcnow()

    db.commit()
    db.refresh(profile)
    return profile
