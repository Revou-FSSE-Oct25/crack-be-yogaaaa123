"""
CrackPOS AI — Backend HTTP Client

ARCHITECTURE RATIONALE:
Instead of the Python AI service connecting directly to PostgreSQL (bypassing
NestJS business logic), all data fetching goes through the NestJS AiDataController
via HTTP. This ensures:

1. Single source of truth — All business logic stays in NestJS.
2. Security — Python AI never touches the database directly.
   Even if the AI service is compromised, the attacker can only read data
   they already have access to via the internal API key.
3. Consistency — No duplicated query logic between Python and TypeScript.
4. Audit trail — All AI data access goes through NestJS, which has request logging.

USAGE:
    client = BackendClient(user_id="...", role="ADMIN")
    summary = await client.get_dashboard_summary()
    low_stock = await client.get_low_stock_products(limit=10)
"""
import httpx
from typing import Any
from app.core.config import settings

_client: httpx.AsyncClient | None = None

def _get_client() -> httpx.AsyncClient:
    """Get or create the shared httpx client (connection pool)."""
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(
            base_url=settings.backend_url,
            timeout=httpx.Timeout(30.0, connect=10.0),
            limits=httpx.Limits(max_keepalive_connections=5, max_connections=10),
        )
    return _client

class BackendClient:
    """HTTP client for the NestJS AiDataController.

    All calls include X-Internal-API-Key header for authentication.
    User context (userId, role) is passed as query parameters.

    Usage:
        client = BackendClient(user_id="uuid-here", role="ADMIN")
        data = await client.get_dashboard_summary()
    """

    def __init__(self, user_id: str, role: str):
        self.user_id = user_id
        self.role = role
        self._headers = {
            "X-Internal-API-Key": settings.backend_internal_api_key,
            "Accept": "application/json",
        }

    async def _get(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        """Make authenticated GET request to NestJS AiDataController."""
        query_params = {"userId": self.user_id, "role": self.role}
        if params:

            for k, v in params.items():
                if v is not None:
                    query_params[k] = v

        client = _get_client()
        try:
            resp = await client.get(
                f"/ai-data{path}",
                headers=self._headers,
                params=query_params,
            )
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPStatusError as e:
            print(f"⚠️ Backend API error {e.response.status_code}: {e.response.text}")
            raise
        except httpx.RequestError as e:
            print(f"⚠️ Backend API request failed: {e}")
            raise

    async def get_dashboard_summary(self) -> dict[str, Any]:
        """Get dashboard KPI summary."""
        return await self._get("/dashboard/summary")

    async def get_low_stock_products(self, limit: int = 20) -> dict[str, Any]:
        """Get products where stock <= reorder point."""
        return await self._get("/products/low-stock", {"limit": limit})

    async def get_top_products(self, limit: int = 10) -> dict[str, Any]:
        """Get top selling products."""
        return await self._get("/products/top", {"limit": limit})

    async def search_products(self, query: str, limit: int = 10) -> dict[str, Any]:
        """Search products by name or SKU."""
        return await self._get("/products/search", {"query": query, "limit": limit})

    async def get_sales_report(
        self,
        start_date: str | None = None,
        end_date: str | None = None,
        limit: int = 20,
    ) -> dict[str, Any]:
        """Get sales report with optional date filtering."""
        return await self._get(
            "/sales/report",
            {"startDate": start_date, "endDate": end_date, "limit": limit},
        )

    async def get_profit_loss(
        self,
        start_date: str | None = None,
        end_date: str | None = None,
    ) -> dict[str, Any]:
        """Get profit & loss report (ADMIN only)."""
        return await self._get(
            "/sales/profit-loss",
            {"startDate": start_date, "endDate": end_date},
        )

    async def get_categories(self) -> dict[str, Any]:
        """Get all categories with product counts."""
        return await self._get("/categories")

    async def get_suppliers(self) -> dict[str, Any]:
        """Get all suppliers with product counts."""
        return await self._get("/suppliers")

    async def get_users(self) -> dict[str, Any]:
        """Get all users. Requires ADMIN role."""
        return await self._get("/users")

async def close_backend_client() -> None:
    """Close the shared httpx client on shutdown."""
    global _client
    if _client and not _client.is_closed:
        await _client.aclose()
        _client = None
        print("🔌 Backend HTTP client closed")

