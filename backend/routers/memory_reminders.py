import base64
import httpx
import asyncio
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage
from db.supabase_client import supabase
from config import GROQ_API_KEY, GROQ_MODEL
from routers.gmail_auth import get_valid_access_token
from datetime import datetime

router = APIRouter(tags=["Memory & Reminders"])
llm    = ChatGroq(model=GROQ_MODEL, api_key=GROQ_API_KEY, temperature=0)

# ── Long-term memory ──────────────────────────────────────────
class MemoryUpdateRequest(BaseModel):
    user_id: str
    current_memory: str
    messages: list

@router.post("/chat/update-memory")
async def update_memory(request: MemoryUpdateRequest):
    conversation = "\n".join(
        f"{m.get('role','?').upper()}: {m.get('content','')[:300]}"
        for m in request.messages
    )
    system = """You are a medical memory extractor.
Extract important health facts from this conversation and merge with existing memory.
Include: symptoms, conditions, medications, allergies, doctor visits, test results, health preferences.
Keep it concise (max 500 words), bullet points, medically relevant only.
Return ONLY the updated memory text."""
    try:
        res = llm.invoke([
            SystemMessage(content=system),
            HumanMessage(content=f"EXISTING MEMORY:\n{request.current_memory or 'Empty'}\n\nNEW CONVERSATION:\n{conversation}")
        ])
        return {"memory": res.content.strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Build beautiful HTML email ────────────────────────────────
def build_reminder_html(med_name: str, dosage: str, frequency: str, meal_time: str) -> str:
    now_str = datetime.now().strftime("%I:%M %p, %d %B %Y")
    rows = ""
    if dosage:    rows += f"<tr><td class='label'>Dosage</td><td class='value'>{dosage}</td></tr>"
    if frequency: rows += f"<tr><td class='label'>Frequency</td><td class='value'>{frequency}</td></tr>"
    if meal_time: rows += f"<tr><td class='label'>When to take</td><td class='value'>{meal_time}</td></tr>"
    rows         += f"<tr><td class='label'>Time</td><td class='value'>{now_str}</td></tr>"

    return f"""<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>
*{{margin:0;padding:0;box-sizing:border-box}}
body{{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#F3F4F6;padding:24px 16px}}
.wrap{{max-width:480px;margin:0 auto}}
.hdr{{background:linear-gradient(135deg,#0F6E56,#1D9E75);border-radius:20px 20px 0 0;padding:32px 24px;text-align:center}}
.icon{{width:64px;height:64px;background:rgba(255,255,255,0.15);border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;font-size:32px}}
.hdr h1{{color:#fff;font-size:22px;font-weight:700;margin-bottom:4px}}
.hdr p{{color:#A7F3D0;font-size:13px}}
.body{{background:#fff;padding:28px 24px;border:1px solid #E5E7EB;border-top:none}}
.greeting{{font-size:15px;color:#374151;margin-bottom:20px;line-height:1.6}}
.med-box{{background:linear-gradient(135deg,#ECFDF5,#D1FAE5);border:1.5px solid #6EE7B7;border-radius:14px;padding:18px 20px;margin-bottom:20px;text-align:center}}
.med-name{{font-size:26px;font-weight:700;color:#065F46}}
table{{width:100%;border-collapse:collapse;margin-bottom:20px}}
.label{{color:#6B7280;font-size:13px;padding:9px 0;border-bottom:1px solid #F3F4F6;width:45%}}
.value{{color:#111827;font-size:13px;font-weight:600;padding:9px 0;border-bottom:1px solid #F3F4F6}}
.tip{{background:#FFFBEB;border:1px solid #FDE68A;border-radius:10px;padding:14px 16px;font-size:13px;color:#92400E;line-height:1.5}}
.ftr{{background:#F9FAFB;border:1px solid #E5E7EB;border-top:none;border-radius:0 0 20px 20px;padding:18px 24px;text-align:center}}
.ftr p{{font-size:12px;color:#9CA3AF;line-height:1.6}}
.badge{{display:inline-block;background:#D1FAE5;color:#065F46;font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;margin-bottom:8px}}
</style>
</head>
<body>
<div class="wrap">
  <div class="hdr">
    <div class="icon">💊</div>
    <h1>Medication Reminder</h1>
    <p>MedAI Health Assistant</p>
  </div>
  <div class="body">
    <p class="greeting">Hey! 👋 It's time to take your medication. Consistency is key to your health.</p>
    <div class="med-box"><div class="med-name">{med_name}</div></div>
    <table>{rows}</table>
    <div class="tip">💡 <strong>Tip:</strong> Take your medication at the same time every day for best results!</div>
  </div>
  <div class="ftr">
    <div><span class="badge">MedAI</span></div>
    <p>You're receiving this because you enabled email reminders in MedAI.<br>Manage your reminders anytime in the app.</p>
  </div>
</div>
</body>
</html>"""


# ── Core send function ────────────────────────────────────────
async def send_reminder_email(user_id: str, user_email: str, med_name: str,
                               dosage: str, frequency: str, meal_time: str) -> dict:
    """
    Core function — gets token, builds email, sends via Gmail API.
    Returns dict with status and detailed error if any.
    """
    print(f"[Email] Attempting to send reminder: {med_name} → {user_email}")

    # 1. Get valid token
    try:
        access_token = await get_valid_access_token(user_id)
        print(f"[Email] Token obtained for user {user_id}")
    except HTTPException as e:
        print(f"[Email] Token error: {e.detail}")
        return {"status": "no_token", "reason": e.detail}
    except Exception as e:
        print(f"[Email] Token exception: {e}")
        return {"status": "error", "reason": str(e)}

    # 2. Build email
    subject = f"💊 Time for {med_name} — MedAI Reminder"
    html    = build_reminder_html(med_name, dosage, frequency, meal_time)

    msg = MIMEMultipart("alternative")
    msg["To"]      = user_email
    msg["From"]    = user_email   # send from user's own Gmail
    msg["Subject"] = subject
    msg.attach(MIMEText(html, "html"))

    # Gmail API needs base64url, NO padding
    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode("utf-8").rstrip("=")

    # 3. Send via Gmail API
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            res = await client.post(
                "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type":  "application/json",
                },
                json={"raw": raw},
            )

        print(f"[Email] Gmail API response: {res.status_code} — {res.text[:200]}")

        if res.status_code in (200, 202):
            data = res.json()
            print(f"[Email] ✅ Sent! Message ID: {data.get('id','?')}")
            return {"status": "sent", "message_id": data.get("id")}
        else:
            # Try to parse error
            try:
                err = res.json()
                reason = err.get("error", {}).get("message", res.text)
            except Exception:
                reason = res.text
            print(f"[Email] ❌ Gmail API error: {reason}")
            return {"status": "gmail_error", "reason": reason, "code": res.status_code}

    except httpx.TimeoutException:
        print("[Email] ❌ Request timed out")
        return {"status": "timeout"}
    except Exception as e:
        print(f"[Email] ❌ Exception: {e}")
        return {"status": "exception", "reason": str(e)}


# ── API endpoint (called from frontend) ──────────────────────
class MedicationReminderRequest(BaseModel):
    user_id: str
    email: str
    medication_name: str
    dosage: str = ""
    frequency: str = ""
    meal_time: str = ""

@router.post("/medications/remind")
async def send_medication_reminder(request: MedicationReminderRequest):
    result = await send_reminder_email(
        request.user_id, request.email,
        request.medication_name, request.dosage,
        request.frequency, request.meal_time,
    )
    return result


# ── Test endpoint — call this to verify setup ─────────────────
@router.post("/medications/test-email")
async def test_email(user_id: str, email: str):
    """
    Call this directly to test Gmail sending.
    POST /medications/test-email?user_id=xxx&email=you@gmail.com
    """
    result = await send_reminder_email(
        user_id, email,
        "Test Medication", "500mg", "Once daily", "After meal"
    )
    return result


# ── Background scheduler ──────────────────────────────────────
async def medication_reminder_scheduler():
    """
    Runs on backend every minute.
    Sends Gmail reminders for ALL users whose medication time matches now.
    Works even when website/browser is closed.
    """
    print("[Scheduler] ✅ Medication reminder scheduler started")
    sent_today: set = set()

    while True:
        try:
            now      = datetime.now()
            time_now = now.strftime("%H:%M")
            date_key = now.strftime("%Y-%m-%d")

            if time_now == "00:00":
                sent_today.clear()
                print("[Scheduler] Daily reset — cleared sent cache")

            # Fetch all active meds with gmail_reminder ON
            result = supabase.table("medications").select(
                "id, user_id, name, dosage, frequency, meal_time, reminder_time, gmail_reminder"
            ).eq("status", "active").eq("gmail_reminder", True).execute()

            meds = result.data or []
            due  = [m for m in meds if m.get("reminder_time") == time_now]

            if due:
                print(f"[Scheduler] {time_now} — {len(due)} reminder(s) due")

            for med in due:
                key = f"{med['id']}-{date_key}"
                if key in sent_today:
                    continue
                sent_today.add(key)

                user_id = med["user_id"]

                # Get user email from gmail_tokens table
                token_row = supabase.table("gmail_tokens").select("gmail_email").eq("user_id", user_id).maybe_single().execute()
                user_email = token_row.data.get("gmail_email") if token_row.data else None

                if not user_email:
                    print(f"[Scheduler] No Gmail connected for user {user_id} — skipping")
                    continue

                await send_reminder_email(
                    user_id, user_email,
                    med.get("name","Medication"),
                    med.get("dosage",""),
                    med.get("frequency",""),
                    med.get("meal_time",""),
                )

        except Exception as e:
            print(f"[Scheduler] ❌ Error: {e}")

        await asyncio.sleep(60)
