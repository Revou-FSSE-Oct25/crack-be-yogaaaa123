# CrackPOS AI Service

Python FastAPI service as an AI Assistant for CrackPOS inventory system.

## Architecture

```
Frontend → POST /chat (JWT Bearer) → AI Service (Python/FastAPI)
                                           ↓
                                    Gemini 1.5 Flash
                                           ↓ (tool calling)
                                    Query PostgreSQL DB
                                           ↓
                                    Response to Frontend
```

## Security Features

1. **Data Isolation**: `userId` and `role` are ALWAYS from JWT token, never from AI input
2. **Hard Limit**: Database queries are capped at a maximum of 50 rows (configured via `MAX_QUERY_LIMIT`)
3. **Role-Based Access**: ADMIN sees all data, STAFF only sees their own data
4. **Tool Timeout**: Each tool execution is timed out after 15 seconds
5. **Fallback Error**: AI is instructed to inform the user if the system errors, not to guess data

## Setup

### 1. Install dependencies

```bash
uv sync
```

### 2. Configure .env

Copy `.env.example` to `.env` and fill in:

```bash
cp .env.example .env
```

What needs to be filled:

- `DATABASE_URL` — same as NestJS backend (already filled automatically)
- `JWT_SECRET` — same as NestJS backend (already filled automatically)
- `GEMINI_API_KEY` — get a free key at https://aistudio.google.com/app/apikey

### 3. Run

```bash
uv run uvicorn main:app --reload --port 8001
```

## API Endpoints

### `GET /health`

Health check (no authentication required).

### `POST /chat`

Chat with AI Assistant.

**Headers:**

```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "message": "what is the best selling product this month?",
  "history": []
}
```

**Response:**

```json
{
  "reply": "Based on this month's sales data, the best selling product is...",
  "tools_used": ["get_top_products"],
  "username": "admin",
  "role": "ADMIN"
}
```

## Available Tools for AI

| Tool                     | Access          | Description                                |
| ------------------------ | --------------- | ------------------------------------------ |
| `get_dashboard_summary`  | ADMIN + STAFF   | Today's & monthly KPIs                     |
| `get_low_stock_products` | ADMIN only      | Products with low stock                    |
| `get_sales_report`       | ADMIN + STAFF\* | Sales report (\*STAFF sees their own only) |
| `get_profit_loss`        | ADMIN only      | Profit and loss report                     |
| `get_top_products`       | ADMIN + STAFF\* | Best selling products                      |
| `search_products`        | ADMIN + STAFF   | Search products by name/SKU                |
| `get_inventory_value`    | ADMIN only      | Total inventory value                      |

## Example Questions

- "Today's sales summary"
- "Which products are running low on stock?"
- "What is the total profit for April?"
- "Search for laptop products"
- "Best selling products this week"
