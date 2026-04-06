import httpx
import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from db.supabase_client import supabase
from datetime import datetime, timedelta, timezone

router = APIRouter(prefix="/auth/gmail", tags=["Gmail OAuth"])

GOOGLE_CLIENT_ID     = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
REDIRECT_URI         = os.getenv("GMAIL_REDIRECT_URI", "http://localhost:5173/gmail-callback")

class ExchangeRequest(BaseModel):
    code: str
    user_id: str

@router.post("/exchange")
async def exchange_code(request: ExchangeRequest):
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="Google OAuth not configured on server.")

    async with httpx.AsyncClient() as client:
        token_res = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code":          request.code,
                "client_id":     GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "redirect_uri":  REDIRECT_URI,
                "grant_type":    "authorization_code",
            },
        )

    if token_res.status_code != 200:
        raise HTTPException(status_code=400, detail=f"Token exchange failed: {token_res.text}")

    tokens        = token_res.json()
    access_token  = tokens.get("access_token")
    refresh_token = tokens.get("refresh_token")
    expires_in    = tokens.get("expires_in", 3600)

    async with httpx.AsyncClient() as client:
        user_res = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )

    if user_res.status_code != 200:
        raise HTTPException(status_code=400, detail="Could not fetch Gmail user info.")

    gmail_info  = user_res.json()
    gmail_email = gmail_info.get("email")

    # Always store timezone-aware UTC
    now        = datetime.now(timezone.utc)
    expires_at = (now + timedelta(seconds=expires_in)).isoformat()

    supabase.table("gmail_tokens").upsert({
        "user_id":       request.user_id,
        "gmail_email":   gmail_email,
        "access_token":  access_token,
        "refresh_token": refresh_token,
        "expires_at":    expires_at,
        "updated_at":    now.isoformat(),
    }, on_conflict="user_id").execute()

    return {"gmail_email": gmail_email, "status": "connected"}


async def get_valid_access_token(user_id: str) -> str:
    """
    Returns a valid Gmail access token.
    Auto-refreshes if expired. All datetimes are timezone-aware UTC.
    """
    result = supabase.table("gmail_tokens").select("*").eq("user_id", user_id).maybe_single().execute()
    row = result.data

    if not row:
        raise HTTPException(status_code=404, detail="Gmail not connected. Please connect Gmail in the app first.")

    now = datetime.now(timezone.utc)

    # Parse expires_at - always make it timezone-aware
    expires_at_str = row.get("expires_at")
    if expires_at_str:
        expires_at = datetime.fromisoformat(expires_at_str)
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
    else:
        expires_at = now  # treat as expired

    # Token still valid (more than 2 mins remaining)
    if expires_at > now + timedelta(minutes=2):
        print(f"[Token] ✅ Valid token for user {user_id}, expires {expires_at}")
        return row["access_token"]

    print(f"[Token] Token expired for user {user_id}, refreshing...")

    refresh_token = row.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Gmail token expired and no refresh token. Please reconnect Gmail.")

    async with httpx.AsyncClient(timeout=15.0) as client:
        refresh_res = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id":     GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "refresh_token": refresh_token,
                "grant_type":    "refresh_token",
            },
        )

    print(f"[Token] Refresh response: {refresh_res.status_code}")

    if refresh_res.status_code != 200:
        raise HTTPException(
            status_code=401,
            detail=f"Token refresh failed ({refresh_res.status_code}). Please reconnect Gmail."
        )

    new_tokens     = refresh_res.json()
    new_access     = new_tokens["access_token"]
    new_expires_at = (now + timedelta(seconds=new_tokens.get("expires_in", 3600))).isoformat()

    supabase.table("gmail_tokens").update({
        "access_token": new_access,
        "expires_at":   new_expires_at,
        "updated_at":   now.isoformat(),
    }).eq("user_id", user_id).execute()

    print(f"[Token] ✅ Token refreshed for user {user_id}")
    return new_access
