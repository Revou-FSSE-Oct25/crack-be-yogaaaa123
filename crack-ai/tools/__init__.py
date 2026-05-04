"""
CrackPOS AI — Shared Tool Utilities
Validation helpers, safe LIMIT capping, and query building utilities.

SECURITY:
- cap(): ensures LIMIT values never exceed settings.max_query_limit (50)
- validate_uuid(): validates UUID format before use in queries
- ALL AI-controlled string args are validated against whitelists:
  - validate_status(): PENDING / RECEIVED / CANCELLED only
  - validate_transaction_type(): IN / OUT / ADJUSTMENT / RETURN only
  - validate_entity(): for activity log filtering
- build_where_and_params(): safe dynamic WHERE clause builder using parameterized queries
"""
from __future__ import annotations

import uuid
from typing import Any

from config import settings

# ─── Tool Dispatcher ───────────────────────────────────────────────────────────
async def execute_tool(
    tool_name: str,
    user_id: str,
    role: str,
    tenant_id: str,
    **kwargs: Any,
) -> dict[str, Any]:
    """
    Dispatch a tool call to the appropriate tool function.

    SECURITY:
    - user_id, role, and tenant_id are ALWAYS from JWT (function parameters)
    - Never take these values from kwargs sent by AI
    - tenant_id ensures multi-tenant data isolation
    """
    from tools.categories import get_categories
    from tools.dashboard import get_dashboard_summary
    from tools.inventory import get_inventory_value, get_stock_transactions
    from tools.products import get_low_stock_products, get_top_products, search_products
    from tools.sales import get_sales_report, get_profit_loss, get_sales_returns
    from tools.suppliers import get_suppliers, get_purchase_orders
    from tools.users import get_users, get_activity_logs

    tool_map = {
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

    fn = tool_map.get(tool_name)
    if fn is None:
        return {"error": f"Tool '{tool_name}' not found."}

    try:
        result = await fn(user_id=user_id, role=role, tenant_id=tenant_id, **kwargs)
        return result
    except PermissionError as e:
        return {"error": f"Access denied: {str(e)}"}
    except ValueError as e:
        return {"error": f"Invalid input: {str(e)}"}
    except Exception as e:
        return {"error": f"An internal error occurred: {str(e)}"}


# ─── Safe LIMIT ────────────────────────────────────────────────────────────────
def cap(value: int | None, default: int = 20) -> int:
    """Ensure LIMIT never exceeds the hard maximum (configurable via max_query_limit)."""
    if value is None:
        return min(default, settings.max_query_limit)
    return max(1, min(int(value), settings.max_query_limit))


# ─── UUID Validation ──────────────────────────────────────────────────────────
def validate_uuid(value: str, name: str = "id") -> str:
    """Validate that a string is a valid UUID. Raises ValueError if not."""
    try:
        uuid.UUID(value)
    except (ValueError, AttributeError):
        raise ValueError(f"Invalid UUID format for '{name}': {value}")
    return value


# ─── String Whitelist Validators ──────────────────────────────────────────────
VALID_STATUSES = frozenset({"PENDING", "RECEIVED", "CANCELLED"})
VALID_TRANSACTION_TYPES = frozenset({"IN", "OUT", "ADJUSTMENT", "RETURN"})


def validate_status(status: str) -> str:
    """Validate purchase order status against whitelist."""
    s = status.strip().upper()
    if s not in VALID_STATUSES:
        raise ValueError(
            f"Invalid status '{status}'. "
            f"Valid values: {', '.join(sorted(VALID_STATUSES))}"
        )
    return s


def validate_transaction_type(txn_type: str) -> str:
    """Validate stock transaction type against whitelist."""
    t = txn_type.strip().upper()
    if t not in VALID_TRANSACTION_TYPES:
        raise ValueError(
            f"Invalid transaction type '{txn_type}'. "
            f"Valid values: {', '.join(sorted(VALID_TRANSACTION_TYPES))}"
        )
    return t


# ─── Entity Validation (for activity_logs filter) ─────────────────────────────
VALID_ENTITIES = frozenset({
    "Product", "SalesOrder", "PurchaseOrder", "User", "Supplier",
    "Category", "StockTransaction", "SalesReturn", "Inventory",
})


def validate_entity(entity: str) -> str:
    """Validate activity log entity name (case-insensitive)."""
    # Capitalize first letter for comparison
    e = entity.strip().capitalize()
    if e not in VALID_ENTITIES:
        raise ValueError(
            f"Invalid entity '{entity}'. "
            f"Valid values: {', '.join(sorted(VALID_ENTITIES))}"
        )
    return e


# ─── Date Validation ──────────────────────────────────────────────────────────
import re

DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def validate_date(date_str: str, name: str = "date") -> str:
    """Validate YYYY-MM-DD date format."""
    if not DATE_PATTERN.match(date_str):
        raise ValueError(f"Invalid {name} format '{date_str}'. Use YYYY-MM-DD.")
    return date_str


# ─── Safe Dynamic WHERE Builder ───────────────────────────────────────────────
# Solves issue #2: Instead of string interpolation for conditions,
# this builder ensures ALL dynamic values use parameterized queries ($1, $2, ...)
WhereClause = tuple[str, list[Any]]  # (WHERE clause, params list)


def build_where(params: list[Any], condition: str, value: Any) -> int:
    """
    Append a parameterized condition and return the new param index.

    Args:
        params: Mutable list of query parameters (grows with each call)
        condition: SQL condition string with $<N> placeholder
        value: Value to append to params

    Returns:
        The index of the newly added parameter (for use in $N placeholder)

    Example:
        params = []
        idx = build_where(params, 'p."categoryId" = $1', category_id)
        # params = [category_id], returns 1
        idx = build_where(params, 'p.price > $2', min_price)
        # params = [category_id, min_price], returns 2
    """
    params.append(value)
    return len(params)


def combine_where(conditions: list[str], initial: str = "TRUE") -> str:
    """
    Combine a list of conditions with AND.

    Args:
        conditions: List of WHERE conditions
        initial: Default value when no conditions (default: 'TRUE')

    Returns:
        Combined WHERE clause string

    Example:
        combine_where(['p."categoryId" = $1', 'p.price > $2'])
        # Returns: 'p."categoryId" = $1 AND p.price > $2'
    """
    if not conditions:
        return initial
    return " AND ".join(conditions)
