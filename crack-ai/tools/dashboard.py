"""
CrackPOS AI — Dashboard Tool

Provides KPI summary data for the AI assistant.
Respects role-based access: ADMIN sees all data, STAFF only sees their own.
TENANT ISOLATION: All queries filtered by tenantId to prevent cross-tenant data leaks.

OPTIMIZED: Uses a single combined query instead of N+1 separate queries.
"""
from __future__ import annotations

from typing import Any

from database import get_pool


async def get_dashboard_summary(
    user_id: str,
    role: str,
    tenant_id: str,
) -> dict[str, Any]:
    """
    Get KPI summary: total products, today's sales, this month's sales, etc.
    user_id from JWT for audit trail. ADMIN sees all, STAFF only sees their own.
    TENANT ISOLATION: All queries filter by tenant_id to prevent cross-tenant data leaks.
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        # ── Combined query: all counts + today/this month sales in 2 queries ──
        # This replaces 7 separate queries with just 2

        # Query 1: Aggregate counts (products, suppliers, categories, low stock)
        # All filtered by tenant_id
        count_row = await conn.fetchrow("""
            SELECT
                (SELECT COUNT(*) FROM products
                 WHERE "deletedAt" IS NULL AND "tenantId" = $1) AS total_products,
                (SELECT COUNT(*) FROM products
                 WHERE "deletedAt" IS NULL AND "stockQuantity" > 0 AND "tenantId" = $1) AS total_in_stock,
                (SELECT COUNT(*) FROM suppliers
                 WHERE "deletedAt" IS NULL AND "tenantId" = $1) AS total_suppliers,
                (SELECT COUNT(*) FROM categories
                 WHERE "deletedAt" IS NULL AND "tenantId" = $1) AS total_categories,
                (SELECT COUNT(*) FROM products
                 WHERE "deletedAt" IS NULL AND "stockQuantity" <= "reorderLevel" AND "tenantId" = $1) AS low_stock_count
        """, tenant_id)

        # Query 2: Today's and This month's sales with dynamic user + tenant filter
        if role == "ADMIN":
            today_month_row = await conn.fetchrow("""
                SELECT
                    COALESCE(SUM(CASE WHEN "createdAt" >= CURRENT_DATE THEN "totalPrice" END), 0) AS today_revenue,
                    COALESCE(SUM(CASE WHEN "createdAt" >= CURRENT_DATE THEN "totalProfit" END), 0) AS today_profit,
                    COUNT(*) FILTER (WHERE "createdAt" >= CURRENT_DATE) AS today_orders,
                    COALESCE(SUM(CASE WHEN "createdAt" >= DATE_TRUNC('month', CURRENT_DATE) THEN "totalPrice" END), 0) AS month_revenue,
                    COALESCE(SUM(CASE WHEN "createdAt" >= DATE_TRUNC('month', CURRENT_DATE) THEN "totalProfit" END), 0) AS month_profit,
                    COUNT(*) FILTER (WHERE "createdAt" >= DATE_TRUNC('month', CURRENT_DATE)) AS month_orders
                FROM sales_orders
                WHERE "deletedAt" IS NULL AND "tenantId" = $1
            """, tenant_id)
        else:
            today_month_row = await conn.fetchrow("""
                SELECT
                    COALESCE(SUM(CASE WHEN "createdAt" >= CURRENT_DATE THEN "totalPrice" END), 0) AS today_revenue,
                    COALESCE(SUM(CASE WHEN "createdAt" >= CURRENT_DATE THEN "totalProfit" END), 0) AS today_profit,
                    COUNT(*) FILTER (WHERE "createdAt" >= CURRENT_DATE) AS today_orders,
                    COALESCE(SUM(CASE WHEN "createdAt" >= DATE_TRUNC('month', CURRENT_DATE) THEN "totalPrice" END), 0) AS month_revenue,
                    COALESCE(SUM(CASE WHEN "createdAt" >= DATE_TRUNC('month', CURRENT_DATE) THEN "totalProfit" END), 0) AS month_profit,
                    COUNT(*) FILTER (WHERE "createdAt" >= DATE_TRUNC('month', CURRENT_DATE)) AS month_orders
                FROM sales_orders
                WHERE "deletedAt" IS NULL
                  AND "userId" = $1
                  AND "tenantId" = $2
            """, user_id, tenant_id)

    return {
        "total_products": count_row["total_products"],
        "total_products_in_stock": count_row["total_in_stock"],
        "total_suppliers": count_row["total_suppliers"],
        "total_categories": count_row["total_categories"],
        "today": {
            "revenue": float(today_month_row["today_revenue"]),
            "profit": float(today_month_row["today_profit"]),
            "order_count": today_month_row["today_orders"],
        },
        "this_month": {
            "revenue": float(today_month_row["month_revenue"]),
            "profit": float(today_month_row["month_profit"]),
            "order_count": today_month_row["month_orders"],
        },
        "low_stock_products_count": count_row["low_stock_count"] if role == "ADMIN" else 0,
        "note": "Data has been filtered according to user role and tenant." if role != "ADMIN" else None,
    }
