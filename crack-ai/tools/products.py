"""
CrackPOS AI — Product Tools

Product-related queries: low stock alerts, search, and top sellers.
Respects role-based access for sensitive stock data.
TENANT ISOLATION: All queries filtered by tenantId to prevent cross-tenant data leaks.

SECURITY: search query length is validated to prevent abuse.
"""
from __future__ import annotations

from typing import Any

from database import get_pool
from tools import cap

MAX_SEARCH_QUERY_LENGTH = 200

async def get_low_stock_products(
    user_id: str,
    role: str,
    tenant_id: str,
    limit: int | None = None,
) -> dict[str, Any]:
    """Get products with stock near or below reorderLevel. ADMIN only. Tenant isolated."""
    if role != "ADMIN":
        return {"error": "Access denied. Only ADMIN can view full stock data."}
    safe_limit = cap(limit, default=20)
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT p.id, p.sku, p.name, p."stockQuantity", p."reorderLevel",
                   c.name AS category_name
            FROM products p
            LEFT JOIN categories c ON p."categoryId" = c.id
            WHERE p."deletedAt" IS NULL
              AND p."stockQuantity" <= p."reorderLevel"
              AND p."tenantId" = $1
            ORDER BY p."stockQuantity" ASC
            LIMIT $2
        """, tenant_id, safe_limit)
    return {
        "count": len(rows),
        "limit_applied": safe_limit,
        "products": [
            {
                "id": r["id"],
                "sku": r["sku"],
                "name": r["name"],
                "stock_quantity": r["stockQuantity"],
                "reorder_level": r["reorderLevel"],
                "category": r["category_name"],
            }
            for r in rows
        ],
    }

async def get_top_products(
    user_id: str,
    role: str,
    tenant_id: str,
    limit: int | None = None,
) -> dict[str, Any]:
    """Top selling products by total quantity sold from COMPLETED orders. Tenant isolated."""
    safe_limit = cap(limit, default=10)
    pool = await get_pool()
    async with pool.acquire() as conn:
        if role == "ADMIN":
            rows = await conn.fetch("""
                SELECT p.name, p.sku,
                       SUM(oi.quantity) AS total_sold,
                       SUM(oi.quantity * oi."unitPrice") AS total_revenue
                FROM order_items oi
                JOIN products p ON oi."productId" = p.id
                JOIN sales_orders so ON oi."orderId" = so.id
                WHERE so.status = 'COMPLETED'
                  AND so."deletedAt" IS NULL
                  AND so."tenantId" = $1
                GROUP BY p.id, p.name, p.sku
                ORDER BY total_sold DESC
                LIMIT $2
            """, tenant_id, safe_limit)
        else:
            rows = await conn.fetch("""
                SELECT p.name, p.sku,
                       SUM(oi.quantity) AS total_sold,
                       SUM(oi.quantity * oi."unitPrice") AS total_revenue
                FROM order_items oi
                JOIN products p ON oi."productId" = p.id
                JOIN sales_orders so ON oi."orderId" = so.id
                WHERE so.status = 'COMPLETED'
                  AND so."deletedAt" IS NULL
                  AND so."userId" = $1
                  AND so."tenantId" = $2
                GROUP BY p.id, p.name, p.sku
                ORDER BY total_sold DESC
                LIMIT $3
            """, user_id, tenant_id, safe_limit)
    return {
        "limit_applied": safe_limit,
        "products": [
            {
                "name": r["name"],
                "sku": r["sku"],
                "total_sold": r["total_sold"],
                "total_revenue": float(r["total_revenue"]),
            }
            for r in rows
        ],
    }

async def search_products(
    user_id: str,
    role: str,
    tenant_id: str,
    query: str,
    limit: int | None = None,
) -> dict[str, Any]:
    """Search products by name or SKU (case-insensitive). Tenant isolated."""

    if not query or not query.strip():
        return {"error": "Search query cannot be empty.", "count": 0, "products": []}

    query = query.strip()
    if len(query) > MAX_SEARCH_QUERY_LENGTH:
        return {"error": f"Search query too long. Maximum {MAX_SEARCH_QUERY_LENGTH} characters.", "count": 0, "products": []}

    safe_limit = cap(limit, default=10)
    search_pattern = f"%{query}%"
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT p.id, p.sku, p.name, p.price,
                   p."stockQuantity", p."reorderLevel",
                   c.name AS category_name,
                   s.name AS supplier_name
            FROM products p
            LEFT JOIN categories c ON p."categoryId" = c.id
            LEFT JOIN suppliers s ON p."supplierId" = s.id
            WHERE p."deletedAt" IS NULL
              AND (LOWER(p.name) LIKE LOWER($1) OR LOWER(p.sku) LIKE LOWER($1))
              AND p."tenantId" = $2
            ORDER BY p.name ASC
            LIMIT $3
        """, search_pattern, tenant_id, safe_limit)
    return {
        "query": query,
        "count": len(rows),
        "limit_applied": safe_limit,
        "products": [
            {
                "id": r["id"],
                "sku": r["sku"],
                "name": r["name"],
                "price": float(r["price"]),
                "stock_quantity": r["stockQuantity"],
                "reorder_level": r["reorderLevel"],
                "category": r["category_name"],
                "supplier": r["supplier_name"],
            }
            for r in rows
        ],
    }

