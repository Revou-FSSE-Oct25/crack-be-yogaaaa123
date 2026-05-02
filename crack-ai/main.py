"""
CrackPOS AI — FastAPI Application
Main entry point for the AI service.

Endpoints:
  GET  /health       — Health check (pings database)
  POST /chat         — Chat with AI (requires JWT)

Observability:
  - Structured logging via structlog (JSON in prod, colorful in dev)
  - x-request-id tracing from NestJS backend (forwarded as X-Request-Id header)
  - All database queries logged with timing

Rate Limiting:
  - /chat endpoint: 10 requests per 60 seconds per IP
  - /health endpoint: no rate limit (unauthenticated health check)

SECURITY STARTUP:
  On boot, validates that INTERNAL_API_KEY is not the default value.
  The service will refuse to start with a weak or default key.
"""
import time
import uuid
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from auth import AuthenticatedUser, get_current_user
from config import settings
from database import close_db, init_db
from backend_client import close_backend_client
from logging_config import get_logger, setup_logging
from schemas import ChatRequest, ChatResponse
import ai_service

# Initialize structured logging
setup_logging()
logger = get_logger(__name__)


# ─── Rate Limiter ──────────────────────────────────────────────────────────────
# Limits /chat to 10 req/min per IP (LLM API costs $$$)
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["20/minute"],  # global default
)


# ─── Startup Security Validation ──────────────────────────────────────────────
def _validate_startup_security() -> None:
    """
    Validate security-critical settings on service startup.
    Refuses to start if any check fails.

    Checks performed:
    1. INTERNAL_API_KEY is not empty
    2. INTERNAL_API_KEY is not the default development value
    3. INTERNAL_API_KEY meets minimum length requirement
    4. JWT_SECRET is not using example/default values
    5. LLM_API_KEY is set
    """
    errors: list[str] = []

    # Check 1-3: INTERNAL_API_KEY
    if not settings.internal_api_key:
        errors.append(
            "SECURITY: INTERNAL_API_KEY is not set! "
            "Generate one with: openssl rand -hex 32"
        )
    elif settings.internal_api_key == "crack-ai-internal-key-dev":
        errors.append(
            "SECURITY: INTERNAL_API_KEY is still set to the default development value "
            "'crack-ai-internal-key-dev'! This is publicly known and exposes the service. "
            "Generate a new random key with: openssl rand -hex 32"
        )
    elif len(settings.internal_api_key) < 16:
        errors.append(
            f"SECURITY: INTERNAL_API_KEY is too short ({len(settings.internal_api_key)} chars). "
            "Minimum 16 characters required. Generate with: openssl rand -hex 32"
        )

    # Check 4: JWT_SECRET must not be example value
    if settings.jwt_secret in ("super-secret-dont-share-123", "secret", "changeme", "password"):
        errors.append(
            "SECURITY: JWT_SECRET appears to be a weak/example value! "
            "Use a strong random secret matching the NestJS backend."
        )

    # Check 5: LLM_API_KEY
    if not settings.llm_api_key:
        errors.append(
            "SECURITY: LLM_API_KEY is not set! "
            "Get a DeepSeek API key at: https://platform.deepseek.com/api_keys"
        )

    if errors:
        error_message = "\n🚨 SECURITY STARTUP FAILED 🚨\n" + "\n\n".join(errors)
        logger.error("Security startup validation failed", errors=errors)
        print(error_message)
        raise SystemExit(1)

    logger.info("Startup security validation passed")


# ─── Request ID Middleware (Observability) ─────────────────────────────────────
async def request_id_middleware(request: Request, call_next):
    """
    Middleware that:
    1. Generates or extracts x-request-id for distributed tracing
    2. Logs every request with timing and ID

    If the NestJS backend forwards an x-request-id header, it is preserved.
    Otherwise, a new UUID is generated.

    This enables end-to-end tracing: User → NestJS → AI → DB → LLM → Response
    """
    # Use forwarded ID or generate new one
    request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
    request.state.request_id = request_id

    # Log request start with context
    start_time = time.time()
    logger.info(
        "Request started",
        request_id=request_id,
        method=request.method,
        path=request.url.path,
        ip=get_remote_address(request),
    )

    # Process request
    response = await call_next(request)

    # Log request completion
    elapsed_ms = round((time.time() - start_time) * 1000, 1)
    logger.info(
        "Request completed",
        request_id=request_id,
        status_code=response.status_code,
        elapsed_ms=elapsed_ms,
    )

    # Forward request ID to response headers
    response.headers["X-Request-Id"] = request_id
    return response


# ─── Lifespan ───────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    logger.info("Starting CrackPOS AI Service...")

    # SECURITY: Validate on every startup
    _validate_startup_security()

    await init_db()
    yield
    logger.info("Shutting down CrackPOS AI Service...")
    await close_db()
    await close_backend_client()


# ─── App ────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="CrackPOS AI Service",
    description="AI Assistant for CrackPOS inventory system with tool-based data retrieval",
    version="1.1.0",
    lifespan=lifespan,
)

# Rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)  # type: ignore

# CORS — allow frontend to access AI service
cors_origins = [o.strip() for o in settings.cors_origins.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type", "X-Internal-API-Key", "X-Request-Id"],
)

# Request ID middleware
app.middleware("http")(request_id_middleware)


# ─── Routes ─────────────────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"])
async def health_check():
    """
    Health check endpoint — no authentication required.

    Returns:
        - status: "ok" if all systems healthy
        - database: "connected" if PostgreSQL responds to SELECT 1
        - service: service identifier
        - response_time_ms: time taken to ping the database
    """
    db_status = "unknown"
    start = time.time()

    try:
        from database import get_pool
        pool = await get_pool()
        async with pool.acquire() as conn:
            await conn.execute("SELECT 1")
        db_status = "connected"
    except Exception as e:
        logger.warning("Health check: database ping failed", error=str(e))
        db_status = "disconnected"

    elapsed_ms = round((time.time() - start) * 1000, 1)

    is_healthy = db_status == "connected"

    return {
        "status": "ok" if is_healthy else "degraded",
        "database": db_status,
        "service": "crack-ai",
        "response_time_ms": elapsed_ms,
    }


@app.post(
    "/chat",
    response_model=ChatResponse,
    tags=["AI Chat"],
    summary="Chat with CrackPOS AI Assistant",
    description="""
    Send a message to the AI and receive answers based on real data from the database.

    **Rate Limit:** 10 requests per 60 seconds per IP (LLM API costs $$$)

    **Security:**
    - Requires valid JWT Bearer Token (same as NestJS backend)
    - userId and role are taken from the token, NOT from the request body
    - AI can only read data according to the logged-in user's access rights
    """,
)
@limiter.limit("10/minute")  # Rate limit: 10 req/min per IP
async def chat_endpoint(
    request: Request,  # Required by slowapi
    body: ChatRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> ChatResponse:
    """
    POST /chat — Main AI chat endpoint.

    SECURITY: current_user is injected from JWT by the get_current_user dependency.
    user_id and role are never taken from the request body.

    OBSERVABILITY: request_id is logged for distributed tracing.
    """
    request_id = getattr(request.state, "request_id", "unknown")

    try:
        # Build history format for LLM
        llm_history = [
            {"role": msg.role, "parts": [{"text": part} for part in msg.parts]}
            for msg in body.history
        ]

        result = await ai_service.chat(
            message=body.message,
            history=llm_history,
            user_id=current_user.user_id,          # ← from JWT
            role=current_user.role,                 # ← from JWT
            tenant_id=current_user.tenant_id,       # ← from JWT (multi-tenant isolation)
            username=current_user.username,         # ← from JWT
            request_id=request_id,                  # ← for tracing
        )

        return ChatResponse(
            reply=result["reply"],
            tools_used=result["tools_used"],
            username=current_user.username,
            role=current_user.role,
        )

    except Exception as e:
        logger.error(
            "Chat endpoint error",
            user=current_user.username,
            request_id=request_id,
            error=str(e),
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AI service is experiencing issues. Please try again.",
        )
