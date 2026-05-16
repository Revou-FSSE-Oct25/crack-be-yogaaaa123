"""
CrackPOS AI — Tool Registry
Imports all domain-specific tool functions and exposes them via TOOL_REGISTRY.
This file serves as the single entry point for the AI chat handler.

SECURITY:
- All AI-controlled string arguments (status, transaction_type, entity) are
  validated against whitelists in tools/base.py BEFORE being used in queries.
- All dynamic values use parameterized asyncpg queries ($1, $2, ...).
- UUID format validation prevents injection via ID fields.
- Role-based access: STAFF filtered to their own data, some tools ADMIN-only.
- Hard limit cap() prevents OOM from unlimited data requests.
- TENANT ISOLATION: All tool functions now require tenant_id parameter,
  enforced by the registry signature. Every SQL query includes tenantId filter.
"""
from __future__ import annotations

from typing import Any

from app.tools.dashboard import get_dashboard_summary
from app.tools.products import get_low_stock_products, get_top_products, search_products
from app.tools.sales import get_sales_report, get_profit_loss, get_sales_returns
from app.tools.inventory import get_inventory_value, get_stock_transactions
from app.tools.categories import get_categories
from app.tools.suppliers import get_suppliers, get_purchase_orders
from app.tools.users import get_users, get_activity_logs

TOOL_REGISTRY: dict[str, Any] = {
    "get_dashboard_summary": get_dashboard_summary,
    "get_low_stock_products": get_low_stock_products,
    "get_sales_report": get_sales_report,
    "get_profit_loss": get_profit_loss,
    "get_top_products": get_top_products,
    "search_products": search_products,
    "get_inventory_value": get_inventory_value,
    "get_categories": get_categories,
    "get_suppliers": get_suppliers,
    "get_purchase_orders": get_purchase_orders,
    "get_stock_transactions": get_stock_transactions,
    "get_sales_returns": get_sales_returns,
    "get_users": get_users,
    "get_activity_logs": get_activity_logs,
}

async def execute_tool(
    tool_name: str,
    user_id: str,
    role: str,
    tenant_id: str,
    **kwargs: Any,
) -> dict[str, Any]:
    """
    Execute a tool by name with the given user context.

    SECURITY:
    - user_id, role, and tenant_id come from JWT, NOT from AI or request body
    - tenant_id ensures multi-tenant data isolation (Admin A cannot see Tenant B data)
    - The tool function receives these values and applies role-based + tenant filtering

    Args:
        tool_name: Name of the tool function in TOOL_REGISTRY
        user_id: User ID from JWT (for auditing / role filtering)
        role: User role from JWT (ADMIN/STAFF)
        tenant_id: Tenant ID from JWT (for multi-tenant data isolation)
        **kwargs: Additional arguments extracted from AI's tool call

    Returns:
        dict with tool results or error message

    Raises:
        ValueError: If tool_name is not found in registry
    """
    tool = TOOL_REGISTRY.get(tool_name)
    if tool is None:
        raise ValueError(f"Unknown tool: '{tool_name}'. Available tools: {', '.join(sorted(TOOL_REGISTRY.keys()))}")

    return await tool(user_id=user_id, role=role, tenant_id=tenant_id, **kwargs)

