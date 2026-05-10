"""
CrackPOS AI — Sales Tools

Sales-related queries: reports, profit/loss, returns.
Respects role-based access: ADMIN sees all data, STAFF only sees their own.
TENANT ISOLATION: All queries filtered by tenantId to prevent cross-tenant data leaks.
All dynamic values use parameterized queries — NO SQL injection.
"""
from __future__ import annotations
from typing import Any
from database import get_pool
from tools import cap

async def get_sales_report(
    user_id: str, role: str, tenant_id: str,
    start_date: str | None = None, end_date: str | None = None,
    limit: int | None = None,
) -> dict[str, Any]:
    """Sales report with date filtering. STAFF only sees their own orders. Tenant isolated."""
    safe_limit = cap(limit, default=20)
    pool = await get_pool()
    conditions = ['so."deletedAt" IS NULL', 'so."tenantId" = $1']
    params: list[Any] = [tenant_id]
    param_index = 1
    if role != "ADMIN":
        param_index += 1
        conditions.append(f'so."userId" = ${param_index}')
        params.append(user_id)
    if start_date:
        param_index += 1
        conditions.append(f'so."createdAt" >= ${param_index}::date')
        params.append(start_date)
    if end_date:
        param_index += 1
        conditions.append(f'so."createdAt" <= ${param_index}::date + interval \'1 day\'')
        params.append(end_date)
    where_clause = " AND ".join(conditions)
    async with pool.acquire() as conn:
        summary_row = await conn.fetchrow(f"""
            SELECT COUNT(*) AS total_orders,
                   COALESCE(SUM(so."totalPrice"), 0) AS total_revenue,
                   COALESCE(SUM(so."totalProfit"), 0) AS total_profit,
                   COALESCE(SUM(so."totalCogs"), 0) AS total_cogs,
                   COALESCE(AVG(so."totalPrice"), 0) AS avg_order_value
            FROM sales_orders so WHERE {where_clause}
        """, *params)
        param_index += 1
        orders = await conn.fetch(f"""
            SELECT so."orderNumber", so.status, so."totalPrice", so."totalProfit",
                   so."createdAt", u.username AS cashier
            FROM sales_orders so
            JOIN users u ON so."userId" = u.id
            WHERE {where_clause}
            ORDER BY so."createdAt" DESC LIMIT ${param_index}
        """, *params, safe_limit)
    return {
        "period": {"start_date": start_date, "end_date": end_date},
        "summary": {
            "total_orders": summary_row["total_orders"],
            "total_revenue": float(summary_row["total_revenue"]),
            "total_profit": float(summary_row["total_profit"]),
            "total_cogs": float(summary_row["total_cogs"]),
            "avg_order_value": float(summary_row["avg_order_value"]),
        },
        "recent_orders_limit": safe_limit,
        "recent_orders": [
            {
                "order_number": o["orderNumber"],
                "status": o["status"],
                "total_price": float(o["totalPrice"]),
                "total_profit": float(o["totalProfit"]),
                "created_at": o["createdAt"].isoformat(),
                "cashier": o["cashier"],
            }
            for o in orders
        ],
    }

async def get_profit_loss(
    user_id: str, role: str, tenant_id: str,
    start_date: str | None = None, end_date: str | None = None,
) -> dict[str, Any]:
    """Profit and loss report. ADMIN only. Tenant isolated."""
    if role != "ADMIN":
        return {"error": "Access denied. Profit/loss is only available for ADMIN."}
    conditions = ['"deletedAt" IS NULL', "status = 'COMPLETED'", '"tenantId" = $1']
    params: list[Any] = [tenant_id]
    param_index = 1
    if start_date:
        param_index += 1
        conditions.append(f'"createdAt" >= ${param_index}::date')
        params.append(start_date)
    if end_date:
        param_index += 1
        conditions.append(f'"createdAt" <= ${param_index}::date + interval \'1 day\'')
        params.append(end_date)
    where_clause = " AND ".join(conditions)
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(f"""
            SELECT COUNT(*) AS total_orders,
                   COALESCE(SUM("totalPrice"), 0) AS total_revenue,
                   COALESCE(SUM("totalCogs"), 0) AS total_cogs,
                   COALESCE(SUM("totalProfit"), 0) AS total_profit
            FROM sales_orders WHERE {where_clause}
        """, *params)
    total_revenue = float(row["total_revenue"])
    total_profit = float(row["total_profit"])
    return {
        "period": {"start_date": start_date, "end_date": end_date},
        "total_orders": row["total_orders"],
        "total_revenue": total_revenue,
        "total_cogs": float(row["total_cogs"]),
        "total_profit": total_profit,
        "profit_margin_pct": round((total_profit / total_revenue * 100) if total_revenue > 0 else 0, 2),
    }

async def get_sales_returns(
    user_id: str, role: str, tenant_id: str,
    limit: int | None = None,
) -> dict[str, Any]:
    """List sales returns. STAFF only sees their own returns. Tenant isolated."""
    safe_limit = cap(limit, default=20)
    pool = await get_pool()
    async with pool.acquire() as conn:
        if role == "ADMIN":
            summary = await conn.fetchrow("""
                SELECT COUNT(*) AS total, COALESCE(SUM("totalRefund"), 0) AS total_refund
                FROM sales_returns
                WHERE "tenantId" = $1
            """, tenant_id)
            rows = await conn.fetch("""
                SELECT sr."returnNumber", sr.status, sr.reason, sr."totalRefund", sr."createdAt",
                       so."orderNumber", u.username
                FROM sales_returns sr
                JOIN sales_orders so ON sr."salesOrderId" = so.id
                JOIN users u ON sr."userId" = u.id
                WHERE sr."tenantId" = $1
                ORDER BY sr."createdAt" DESC LIMIT $2
            """, tenant_id, safe_limit)
        else:
            summary = await conn.fetchrow("""
                SELECT COUNT(*) AS total, COALESCE(SUM("totalRefund"), 0) AS total_refund
                FROM sales_returns
                WHERE "userId" = $1 AND "tenantId" = $2
            """, user_id, tenant_id)
            rows = await conn.fetch("""
                SELECT sr."returnNumber", sr.status, sr.reason, sr."totalRefund", sr."createdAt",
                       so."orderNumber", u.username
                FROM sales_returns sr
                JOIN sales_orders so ON sr."salesOrderId" = so.id
                JOIN users u ON sr."userId" = u.id
                WHERE sr."userId" = $1 AND sr."tenantId" = $2
                ORDER BY sr."createdAt" DESC LIMIT $3
            """, user_id, tenant_id, safe_limit)
    return {
        "summary": {"total_returns": summary["total"], "total_refund": float(summary["total_refund"])},
        "returns": [
            {
                "return_number": r["returnNumber"],
                "status": r["status"],
                "reason": r["reason"],
                "total_refund": float(r["totalRefund"]),
                "order_number": r["orderNumber"],
                "processed_by": r["username"],
                "created_at": r["createdAt"].isoformat(),
            }
            for r in rows
        ],
    }

