"""
CrackPOS AI — Categories Tool
List all product categories with product counts.
TENANT ISOLATION: All queries filtered by tenantId to prevent cross-tenant data leaks.
"""
from __future__ import annotations
from typing import Any
from app.db.database import get_pool

async def get_categories(user_id: str, role: str, tenant_id: str) -> dict[str, Any]:
    """List all product categories. Tenant isolated."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT c.id, c.name, c.description, COUNT(p.id) AS product_count
            FROM categories c
            LEFT JOIN products p ON p."categoryId" = c.id AND p."deletedAt" IS NULL
            WHERE c."deletedAt" IS NULL AND c."tenantId" = $1
            GROUP BY c.id, c.name, c.description
            ORDER BY c.name ASC
        """, tenant_id)
    return {
        "count": len(rows),
        "categories": [
            {"id": r["id"], "name": r["name"], "description": r["description"], "product_count": r["product_count"]}
            for r in rows
        ],
    }

