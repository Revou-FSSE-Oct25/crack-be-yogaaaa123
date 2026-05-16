"""
CrackPOS AI — Supplier & Purchase Tools
Supplier and purchase order queries. ADMIN only.
TENANT ISOLATION: All queries filtered by tenantId to prevent cross-tenant data leaks.
"""
from __future__ import annotations
from typing import Any
from app.db.database import get_pool
from app.tools import cap, validate_status, VALID_STATUSES

async def get_suppliers(user_id: str, role: str, tenant_id: str, limit: int | None = None) -> dict[str, Any]:
    """List suppliers. ADMIN only. Tenant isolated."""
    if role != "ADMIN":
        return {"error": "Access denied. Only ADMIN can view supplier data."}
    safe_limit = cap(limit, default=50)
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT s.id, s.name, s."contactName", s.phone, s.email, s.address,
                   COUNT(p.id) AS product_count
            FROM suppliers s
            LEFT JOIN products p ON p."supplierId" = s.id AND p."deletedAt" IS NULL
            WHERE s."deletedAt" IS NULL AND s."tenantId" = $1
            GROUP BY s.id ORDER BY s.name ASC LIMIT $2
        """, tenant_id, safe_limit)
    return {
        "count": len(rows),
        "suppliers": [
            {
                "id": r["id"], "name": r["name"], "contact_name": r["contactName"],
                "phone": r["phone"], "email": r["email"], "product_count": r["product_count"],
            }
            for r in rows
        ],
    }

async def get_purchase_orders(
    user_id: str, role: str, tenant_id: str,
    start_date: str | None = None, end_date: str | None = None,
    status: str | None = None, limit: int | None = None,
) -> dict[str, Any]:
    """List purchase orders. ADMIN only. Tenant isolated."""
    if role != "ADMIN":
        return {"error": "Access denied. Only ADMIN can view purchase orders."}
    safe_limit = cap(limit, default=20)
    conditions = ['po."deletedAt" IS NULL', 'po."tenantId" = $1']
    params: list[Any] = [tenant_id]
    param_index = 1
    if start_date:
        param_index += 1
        conditions.append(f'po."createdAt" >= ${param_index}::date')
        params.append(start_date)
    if end_date:
        param_index += 1
        conditions.append(f'po."createdAt" <= ${param_index}::date + interval \'1 day\'')
        params.append(end_date)
    if status:
        validated_status = validate_status(status)
        param_index += 1
        conditions.append(f'po.status = ${param_index}')
        params.append(validated_status)
    where_clause = " AND ".join(conditions)
    param_index += 1
    pool = await get_pool()
    async with pool.acquire() as conn:
        summary = await conn.fetchrow(f"""
            SELECT COUNT(*) AS total, COALESCE(SUM("totalPrice"), 0) AS total_value
            FROM purchase_orders po WHERE {where_clause}
        """, *params)
        rows = await conn.fetch(f"""
            SELECT po."orderNumber", po.status, po."totalPrice", po."createdAt",
                   s.name AS supplier_name, u.username AS created_by
            FROM purchase_orders po
            JOIN suppliers s ON po."supplierId" = s.id
            JOIN users u ON po."userId" = u.id
            WHERE {where_clause}
            ORDER BY po."createdAt" DESC LIMIT ${param_index}
        """, *params, safe_limit)
    return {
        "summary": {"total_orders": summary["total"], "total_value": float(summary["total_value"])},
        "orders": [
            {
                "order_number": r["orderNumber"], "status": r["status"],
                "total_price": float(r["totalPrice"]), "supplier": r["supplier_name"],
                "created_by": r["created_by"], "created_at": r["createdAt"].isoformat(),
            }
            for r in rows
        ],
    }

