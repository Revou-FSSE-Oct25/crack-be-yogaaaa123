"""
CrackPOS AI — JWT Auth + Internal API Key Verification
Verifies JWT tokens issued by the NestJS backend OR internal API key from backend-to-AI calls.
userId, role, and tenantId are ALWAYS taken from the token/API key context, NEVER from AI or user input.

TENANT ISOLATION FIX (Critical):
- tenantId is now extracted from JWT payload and included in AuthenticatedUser
- Every SQL query in tool functions MUST include WHERE "tenantId" = $N clause
- This prevents cross-tenant data leaks (Admin Tenant A seeing Tenant B's data)

SECURITY FIX (Auth Bypass):
- Internal API key ONLY authenticates that the request comes from NestJS backend
- NestJS ALWAYS forwards the original user's JWT in the Authorization header
- So when internal API key is valid, we STILL verify the forwarded JWT to get the real user
- This prevents the "system/ADMIN" bypass where any NestJS service could impersonate ADMIN
"""
from fastapi import Header, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from typing import Optional

from app.core.config import settings

bearer_scheme = HTTPBearer(auto_error=False)

class AuthenticatedUser:
    """Represents a verified user from JWT or internal API key.

    SECURITY: tenantId is extracted from JWT to enforce multi-tenant data isolation.
    All database queries in tool functions MUST filter by this tenantId.
    """

    def __init__(self, user_id: str, username: str, role: str, tenant_id: str = ""):
        self.user_id = user_id
        self.username = username
        self.role = role
        self.tenant_id = tenant_id

    def __repr__(self) -> str:
        return f"AuthenticatedUser(id={self.user_id}, username={self.username}, role={self.role}, tenant_id={self.tenant_id})"

def verify_token(token: str) -> AuthenticatedUser:
    """
    Verify JWT token using the same secret as NestJS.
    Returns AuthenticatedUser if valid, raises 401 if not.
    Now includes tenantId extraction for multi-tenant data isolation.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
        user_id: str | None = payload.get("sub")
        username: str | None = payload.get("username")
        role: str | None = payload.get("role")
        tenant_id: str | None = payload.get("tenantId")

        if not user_id or not username or not role:
            raise credentials_exception

        if role == "SUPER_ADMIN" and not tenant_id:
            tenant_id = ""

        return AuthenticatedUser(
            user_id=user_id,
            username=username,
            role=role,
            tenant_id=tenant_id or "",
        )

    except JWTError:
        raise credentials_exception

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(bearer_scheme),
    x_internal_api_key: Optional[str] = Header(default=None, alias="X-Internal-API-Key"),
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
) -> AuthenticatedUser:
    """
    FastAPI dependency — supports two authentication methods:

    METHOD 1: JWT Bearer Token (from frontend users)
        - User's browser sends Authorization: Bearer <jwt>
        - The JWT is verified directly

    METHOD 2: Internal API Key + Forwarded JWT (from NestJS backend)
        - NestJS sends X-Internal-API-Key + Authorization: Bearer <user-jwt>
        - Internal API key verifies the request is from NestJS (not an external attacker)
        - The forwarded JWT is then verified to get the REAL user identity
        - This prevents "system/ADMIN" privilege escalation

    SECURITY FIX (Critical):
        Previously, when internal API key was valid, the system returned a hardcoded
        "system/ADMIN" user. This was an AUTH BYPASS vulnerability — any compromised
        NestJS service (or anyone who obtained the internal key) could act as ADMIN.

        Now, even with a valid internal key, we EXTRACT THE ACTUAL USER from the
        forwarded JWT. The internal key only proves "this request came from NestJS,"
        not "this request is an admin."

    TENANT ISOLATION FIX:
        tenantId is now extracted from JWT payload to enforce multi-tenant data isolation.
        All tool functions will use this tenantId to filter database queries.
    """

    internal_key_valid = False
    if x_internal_api_key:
        if x_internal_api_key == settings.internal_api_key:
            internal_key_valid = True
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid internal API key",
            )

    jwt_token: str | None = None

    if credentials:

        jwt_token = credentials.credentials
    elif authorization:

        if authorization.startswith("Bearer "):
            jwt_token = authorization[len("Bearer "):]
        else:
            jwt_token = authorization

    if not jwt_token:
        if internal_key_valid:

            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=(
                    "Internal API key accepted but no JWT token provided. "
                    "NestJS must forward the user's Authorization header."
                ),
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=(
                "Not authenticated. Provide either Authorization Bearer token "
                "or X-Internal-API-Key header with forwarded JWT."
            ),
        )

    user = verify_token(jwt_token)

    if internal_key_valid:
        print(
            f"[Auth] Proxied request via NestJS backend — "
            f"user={user.username} (id={user.user_id}, role={user.role}, tenant_id={user.tenant_id})"
        )

    return user

