# 🚀 CrackPOS AI Improvement Plan

## 📋 Current Architecture

```
Frontend → POST /chat (JWT Bearer) → AI Service (Python/FastAPI)
                                           ↓
                                    DeepSeek V4 Flash
                                           ↓ (tool calling)
                                    Query PostgreSQL DB
                                           ↓
                                    Response to Frontend
```

**Current Model:** `deepseek-v4-flash` (via OpenAI SDK)
**Temperature:** 0.1
**Tools:** 14 function tools
**Max iterations:** 5

---

## ✅ Phase 1: Quick Wins (SELESAI ✅)

### 1.1 ✅ Optimasi Parameter Model

**File:** `crack-ai/ai_service.py`

| Parameter           | Before | After   | Alasan                           |
| ------------------- | ------ | ------- | -------------------------------- |
| temperature         | 0.1    | **0.0** | Tool calling butuh deterministik |
| max_tool_iterations | 5      | **3**   | Hemat token, 3 iterasi cukup     |

### 1.2 ✅ Perbaiki System Prompt dengan Few-Shot Examples

**File:** `crack-ai/ai_service.py`

Perubahan:

- **Tool Selection Guide** — tabel decision tree 14 tools
- **5 Few-Shot Examples** — Sales Summary, Low Stock, Profit & Loss, Top Products, Product Search
- Setiap contoh menunjukkan: pertanyaan → tool call → format respons yang benar

### 1.3 ✅ Parallel Tool Execution

**File:** `crack-ai/ai_service.py`

Perubahan:

- Sequential `for tc in tool_calls:` → Parallel `asyncio.gather()`
- Multiple tool calls sekarang dieksekusi bersamaan (lebih cepat)
- Error handling: jika satu tool gagal, tool lain tetap jalan

---

## 🏗️ Phase 2: Structural Improvements (2-3 jam)

### 2.1 Implementasi Caching

**File baru:** `crack-ai/cache.py`

```python
# Simple TTL cache untuk query yang sama dalam 60 detik
_cache = {}
_cache_ttl = 60

async def get_cached_or_fresh(tool_name, user_id, args, fetch_fn):
    cache_key = f"{tool_name}:{user_id}:{json.dumps(args, sort_keys=True)}"
    ...
```

**Kenapa penting:** User sering nanya "sales today" berulang kali. Cache hemat query DB.

**Effort:** 20 menit | **Impact:** 🔥🔥

### 2.2 RAG Context Enhancement

**File:** `crack-ai/ai_service.py`

Sebelum AI menjawab, extract keywords dari pertanyaan user dan cari konteks relevan:

- Nama produk → cari detail produk
- Nama kategori → cari info kategori
- Nama supplier → cari info supplier

Kirim sebagai context tambahan ke AI.

**Effort:** 1 jam | **Impact:** 🔥🔥🔥

### 2.3 Streaming Response (SSE)

**File baru:** `crack-ai/stream_handler.py`

Implementasi Server-Sent Events biar user lihat respons real-time:

1. Kirim "🔍 Menganalisis pertanyaan..."
2. Kirim "📊 Mengambil data dari database..."
3. Kirim hasil akhir

**Effort:** 30 menit | **Impact:** 🔥 (UX improvement)

---

## 🧠 Phase 3: Advanced (4-8 jam)

### 3.1 Multi-Turn Context Awareness

**File:** `crack-ai/context.py`

Biar AI ingat konteks percakapan:

- Track last mentioned product/category
- Track last date range yang dibahas
- Support follow-up seperti "what about last week?"

### 3.2 Evaluasi & Monitoring

**File baru:** `crack-ai/monitoring.py`

Log setiap interaksi ke database:

```sql
CREATE TABLE ai_interactions (
    id UUID PRIMARY KEY,
    user_id UUID,
    question TEXT,
    tools_called TEXT[],
    latency_ms INTEGER,
    tokens_used INTEGER,
    user_feedback BOOLEAN,
    created_at TIMESTAMP
);
```

### 3.3 Smart Tool Selection dengan Embeddings

**File baru:** `crack-ai/embeddings.py`

Gunakan embeddings untuk mencocokkan pertanyaan user dengan tool yang tepat:

- Generate embedding untuk setiap tool description
- Generate embedding untuk pertanyaan user
- Cosine similarity untuk pilih tool terbaik

---

## 📊 Priority Matrix

| Action                  | Effort   | Impact | Priority |
| ----------------------- | -------- | ------ | -------- |
| ✅ Temperature → 0.0    | 1 menit  | 🔥🔥🔥 | **P1**   |
| ✅ Few-shot examples    | 15 menit | 🔥🔥🔥 | **P1**   |
| ✅ Parallel tool exec   | 10 menit | 🔥🔥   | **P1**   |
| ✅ Tool selection guide | 10 menit | 🔥🔥   | **P1**   |
| ⏳ Caching              | 20 menit | 🔥🔥   | **P2**   |
| ⏳ RAG context          | 1 jam    | 🔥🔥🔥 | **P2**   |
| ⏳ Streaming            | 30 menit | 🔥     | **P3**   |
| ⏳ Multi-turn context   | 2 jam    | 🔥🔥   | **P3**   |
| ⏳ Monitoring           | 2 jam    | 🔥🔥🔥 | **P3**   |
| ⏳ Embeddings           | 4 jam    | 🔥🔥🔥 | **P4**   |

---

## 🚦 Recommended First Steps

### Step 1: Ganti Model (5 menit)

Di `.env`:

```
DEEPSEEK_MODEL=deepseek-chat
```

Atau daftar OpenAI dan pakai `gpt-4o-mini` (lebih akurat).

### Step 2: Optimasi Prompt + Temperature (15 menit)

- Temperature → 0.0
- Tambah few-shot examples
- Tambah tool selection guide

### Step 3: Parallel Execution (10 menit)

- Ubah loop sequential jadi `asyncio.gather()`

---

## 📝 Files to Modify

| File                     | Changes                                                   |
| ------------------------ | --------------------------------------------------------- |
| `crack-ai/ai_service.py` | System prompt, temperature, parallel exec, max iterations |
| `crack-ai/.env`          | Model name                                                |
| `crack-ai/cache.py`      | **NEW** - Caching layer                                   |
| `crack-ai/context.py`    | **NEW** - Context management                              |
| `crack-ai/monitoring.py` | **NEW** - Interaction logging                             |

---

## 💡 Model Recommendations

| Model                           | Cost | Speed    | Accuracy   | Setup                    |
| ------------------------------- | ---- | -------- | ---------- | ------------------------ |
| **DeepSeek V4 (deepseek-chat)** | 💰   | ⚡⚡     | ⭐⭐⭐⭐   | Already have API key     |
| **GPT-4o-mini**                 | 💰💰 | ⚡⚡⚡   | ⭐⭐⭐⭐⭐ | Need OpenAI key          |
| **Claude 3.5 Haiku**            | 💰💰 | ⚡⚡⚡   | ⭐⭐⭐⭐⭐ | Need Anthropic key       |
| **Gemini 2.0 Flash**            | 🆓   | ⚡⚡⚡⚡ | ⭐⭐⭐⭐   | Free, need Google AI key |

**Rekomendasi:** Coba `deepseek-chat` dulu (API key sudah ada), kalau masih kurang ganti ke `gpt-4o-mini`.
