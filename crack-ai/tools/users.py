"""
CrackPOS AI — User & Activity Log Tools
Admin-only queries: user list and system activity/audit log.
TENANT ISOLATION: All queries filtered by tenantId to prevent cross-tenant data leaks.
"""
from __future__ import annotations
from typing import Any
from database import get_pool
from tools import cap, validate_entity

async def get_users(user_id: str, role: str, tenant_id: str) -> dict[str, Any]:
    """List users/cashiers. ADMIN only. Tenant isolated."""
    if role != "ADMIN":
        return {"error": "Access denied. Only ADMIN can view the user list."}
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT u.id, u.username, u.email, u.role, u."createdAt",
                   COUNT(DISTINCT so.id) AS total_sales
            FROM users u
            LEFT JOIN sales_orders so ON so."userId" = u.id AND so."deletedAt" IS NULL
            WHERE u."deletedAt" IS NULL AND u."tenantId" = $1
            GROUP BY u.id ORDER BY u."createdAt" ASC
        """, tenant_id)
    return {
        "count": len(rows),
        "users": [
            {
                "id": r["id"], "username": r["username"], "email": r["email"],
                "role": r["role"], "total_sales_processed": r["total_sales"],
                "created_at": r["createdAt"].isoformat(),
            }
            for r in rows
        ],
    }

async def get_activity_logs(
    user_id: str, role: str, tenant_id: str,
    entity: str | None = None, limit: int | None = None,
) -> dict[str, Any]:
    """System activity history (audit log). ADMIN only. Tenant isolated."""
    if role != "ADMIN":
        return {"error": "Access denied. Only ADMIN can view activity logs."}
    safe_limit = cap(limit, default=20)
    conditions: list[str] = ['al."tenantId" = $1']
    params: list[Any] = [tenant_id]
    param_index = 1
    if entity:
        validated_entity = validate_entity(entity)
        param_index += 1
        conditions.append(f'al.entity ILIKE ${param_index}')
        params.append(f'%{validated_entity}%')
    where_clause = " AND ".join(conditions)
    param_index += 1
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(f"""
            SELECT al.action, al.entity, al."entityId", al."createdAt", u.username
            FROM activity_logs al
            JOIN users u ON al."userId" = u.id
            WHERE {where_clause}
            ORDER BY al."createdAt" DESC LIMIT ${param_index}
        """, *params, safe_limit)
    return {
        "count": len(rows),
        "logs": [
            {
                "action": r["action"], "entity": r["entity"],
                "entity_id": r["entityId"], "by": r["username"],
                "at": r["createdAt"].isoformat(),
            }
            for r in rows
        ],
    }

