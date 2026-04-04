from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from db.supabase_client import supabase

# Public routes that don't need auth
PUBLIC_PATHS = {"/", "/health", "/auth/signup", "/auth/login", "/docs", "/openapi.json", "/redoc"}

class SupabaseAuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Skip auth for public paths
        if request.url.path in PUBLIC_PATHS or request.method == "OPTIONS":
            return await call_next(request)

        token = request.headers.get("Authorization", "").replace("Bearer ", "").strip()

        if not token:
            return JSONResponse(status_code=401, content={"detail": "Missing authentication token."})

        try:
            user = supabase.auth.get_user(token)
            if not user or not user.user:
                return JSONResponse(status_code=401, content={"detail": "Invalid or expired token."})
            # Attach user to request state
            request.state.user = user.user
        except Exception:
            return JSONResponse(status_code=401, content={"detail": "Token verification failed."})

        return await call_next(request)
