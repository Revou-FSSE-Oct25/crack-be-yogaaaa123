"""
CrackPOS AI — Inventory Tools

Inventory-related queries: total inventory value, stock transactions.
ADMIN only. All AI-controlled string arguments validated against whitelists.
TENANT ISOLATION: All queries filtered by tenantId to prevent cross-tenant data leaks.
"""
from __future__ import annotations
from typing import Any
from database import get_pool
from tools import cap, validate_transaction_type, validate_uuid

async def get_inventory_value(user_id: str, role: str, tenant_id: str) -> dict[str, Any]:
    """Current total inventory value. ADMIN only. Tenant isolated."""
    if role != "ADMIN":
        return {"error": "Access denied. Inventory value data is for ADMIN only."}
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT COUNT(*) AS total_products,
                   COALESCE(SUM("stockQuantity"), 0) AS total_stock_items,
                   COALESCE(SUM("stockQuantity" * price), 0) AS total_inventory_value,
                   COALESCE(SUM("stockQuantity" * "averageCost"), 0) AS total_cost_value
            FROM products
            WHERE "deletedAt" IS NULL AND "tenantId" = $1
        """, tenant_id)
    return {
        "total_products": row["total_products"],
        "total_stock_items": row["total_stock_items"],
        "total_inventory_value_at_price": float(row["total_inventory_value"]),
        "total_inventory_value_at_cost": float(row["total_cost_value"]),
    }

async def get_stock_transactions(
    user_id: str, role: str, tenant_id: str,
    product_id: str | None = None, transaction_type: str | None = None,
    limit: int | None = None,
) -> dict[str, Any]:
    """Stock transaction history. ADMIN only. Tenant isolated."""
    if role != "ADMIN":
        return {"error": "Access denied. Only ADMIN can view stock history."}
    safe_limit = cap(limit, default=20)
    conditions: list[str] = ['st."tenantId" = $1']
    params: list[Any] = [tenant_id]
    param_index = 1
    if product_id:
        validate_uuid(product_id, "product_id")
        param_index += 1
        conditions.append(f'st."productId" = ${param_index}')
        params.append(product_id)
    if transaction_type:
        validated_type = validate_transaction_type(transaction_type)
        param_index += 1
        conditions.append(f'st.type = ${param_index}')
        params.append(validated_type)
    where_clause = " AND ".join(conditions)
    param_index += 1
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(f"""
            SELECT st.type, st.quantity, st.notes, st."createdAt",
                   p.name AS product_name, p.sku, u.username
            FROM stock_transactions st
            JOIN products p ON st."productId" = p.id
            JOIN users u ON st."userId" = u.id
            WHERE {where_clause}
            ORDER BY st."createdAt" DESC LIMIT ${param_index}
        """, *params, safe_limit)
    return {
        "count": len(rows),
        "transactions": [
            {
                "type": r["type"],
                "quantity": r["quantity"],
                "product": r["product_name"],
                "sku": r["sku"],
                "notes": r["notes"],
                "by": r["username"],
                "at": r["createdAt"].isoformat(),
            }
            for r in rows
        ],
    }

