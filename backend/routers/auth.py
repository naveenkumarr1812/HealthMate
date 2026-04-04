from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from db.supabase_client import supabase

router = APIRouter(prefix="/auth", tags=["Auth"])

class SignupRequest(BaseModel):
    email: str
    password: str
    full_name: str

class LoginRequest(BaseModel):
    email: str
    password: str

class UpdateProfileRequest(BaseModel):
    user_id: str
    conditions: list[str] = []
    allergies: list[str] = []

@router.post("/signup")
async def signup(request: SignupRequest):
    """Register a new user with Supabase Auth."""
    try:
        response = supabase.auth.sign_up({
            "email": request.email,
            "password": request.password,
            "options": {"data": {"full_name": request.full_name}},
        })
        if response.user:
            # Initialize empty health profile
            supabase.table("user_health_profiles").insert({
                "user_id": str(response.user.id),
                "conditions": [],
                "allergies": [],
                "sugar_trend": "unknown",
                "bp_trend": "unknown",
                "recent_reports_summary": "",
            }).execute()
            return {
                "user_id": str(response.user.id),
                "email": response.user.email,
                "message": "Account created successfully.",
            }
        raise HTTPException(status_code=400, detail="Signup failed.")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/login")
async def login(request: LoginRequest):
    """Log in and get Supabase JWT session."""
    try:
        response = supabase.auth.sign_in_with_password({
            "email": request.email,
            "password": request.password,
        })
        session = response.session
        user = response.user
        if session:
            return {
                "access_token": session.access_token,
                "user_id": str(user.id),
                "email": user.email,
                "full_name": user.user_metadata.get("full_name", ""),
            }
        raise HTTPException(status_code=401, detail="Invalid credentials.")
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))

@router.post("/logout")
async def logout():
    """Logs out current Supabase session."""
    supabase.auth.sign_out()
    return {"message": "Logged out successfully."}

@router.get("/profile/{user_id}")
async def get_profile(user_id: str):
    """Fetches user's health profile."""
    try:
        result = (
            supabase.table("user_health_profiles")
            .select("*")
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        return result.data or {}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/profile")
async def update_profile(request: UpdateProfileRequest):
    """Manually update user conditions and allergies."""
    try:
        supabase.table("user_health_profiles").upsert({
            "user_id": request.user_id,
            "conditions": request.conditions,
            "allergies": request.allergies,
        }).execute()
        return {"status": "updated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
