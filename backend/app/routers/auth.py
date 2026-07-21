"""Authentication router — login, profile, and officer management endpoints."""

import os
import shutil
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import (
    create_access_token,
    get_current_admin_user,
    get_current_user,
    get_password_hash,
    verify_password,
)
from app.database import get_db
from app.models import User
from app.schemas import OfficerCreate, Token, UserLogin, UserResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])

# Directory for uploaded government documents
UPLOAD_DIR = "uploads/documents"
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------

@router.post("/login", response_model=Token, summary="Login — ADMIN or OFFICER only")
async def login(payload: UserLogin, db: AsyncSession = Depends(get_db)):
    """Authenticate with email + password.

    Returns a JWT token and the full user object.
    Only ADMIN and OFFICER roles are permitted; citizens have no login.
    """
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated.",
        )

    if user.role not in ("ADMIN", "OFFICER"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid email or password.",
        )

    access_token = create_access_token(data={"sub": str(user.id)})
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


# ---------------------------------------------------------------------------
# Current user profile
# ---------------------------------------------------------------------------

@router.get("/me", response_model=UserResponse, summary="Get current user profile")
async def get_me(current_user: User = Depends(get_current_user)):
    """Return the profile of the currently authenticated user."""
    return UserResponse.model_validate(current_user)


# ---------------------------------------------------------------------------
# Officer management (ADMIN only)
# ---------------------------------------------------------------------------

@router.post(
    "/officers",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new government officer (ADMIN only)",
)
async def register_officer(
    full_name: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    city: Optional[str] = Form(None),
    gender: Optional[str] = Form(None),
    date_of_birth: Optional[str] = Form(None),
    document: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
):
    """Create a new OFFICER account.

    Accepts multipart/form-data so that an optional government document
    can be uploaded alongside the registration fields.
    Only accessible to authenticated ADMIN users.
    """
    # Duplicate email check
    result = await db.execute(select(User).where(User.email == email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email address already exists.",
        )

    # Save uploaded document (optional)
    doc_path: Optional[str] = None
    if document and document.filename:
        safe_name = f"{email.replace('@', '_').replace('.', '_')}_{document.filename}"
        dest = os.path.join(UPLOAD_DIR, safe_name)
        with open(dest, "wb") as f:
            shutil.copyfileobj(document.file, f)
        doc_path = dest

    officer = User(
        email=email,
        full_name=full_name,
        hashed_password=get_password_hash(password),
        role="OFFICER",
        city=city,
        gender=gender,
        date_of_birth=date_of_birth,
        document_path=doc_path,
        is_active=True,
    )
    db.add(officer)
    await db.commit()
    await db.refresh(officer)
    return UserResponse.model_validate(officer)


@router.get(
    "/officers",
    response_model=List[UserResponse],
    summary="List all officers (ADMIN only)",
)
async def list_officers(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
):
    """Return all users with role=OFFICER."""
    result = await db.execute(select(User).where(User.role == "OFFICER"))
    officers = result.scalars().all()
    return [UserResponse.model_validate(o) for o in officers]


@router.delete(
    "/officers/{officer_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an officer (ADMIN only)",
)
async def delete_officer(
    officer_id: int,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
):
    """Permanently remove an OFFICER account."""
    result = await db.execute(
        select(User).where(User.id == officer_id, User.role == "OFFICER")
    )
    officer = result.scalar_one_or_none()
    if not officer:
        raise HTTPException(status_code=404, detail="Officer not found.")
    await db.delete(officer)
    await db.commit()
