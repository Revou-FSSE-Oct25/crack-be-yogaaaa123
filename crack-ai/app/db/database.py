import asyncpg
from app.core.config import settings

_pool: asyncpg.Pool | None = None

async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        raise RuntimeError("Database pool not initialized. Call init_db() first.")

    try:
        async with _pool.acquire() as conn:
            await conn.execute("SELECT 1")
    except (asyncpg.InterfaceError, asyncpg.PostgresError, ConnectionError, OSError):
        print("Database pool connection lost. Attempting to reconnect...")
        try:
            try:
                await _pool.close()
            except Exception:
                pass

            _pool = await asyncpg.create_pool(
                dsn=settings.database_url,
                min_size=2,
                max_size=10,
                command_timeout=30,
            )
            print("Database pool reconnected successfully")

            async with _pool.acquire() as conn:
                await conn.execute("""
                    CREATE TABLE IF NOT EXISTS ai_audit_logs (
                        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                        user_id TEXT NOT NULL,
                        username TEXT NOT NULL,
                        role TEXT NOT NULL,
                        tenant_id TEXT NOT NULL,
                        query TEXT NOT NULL,
                        tools_used JSONB DEFAULT '[]',
                        response_summary TEXT,
                        request_id TEXT,
                        created_at TIMESTAMPTZ DEFAULT NOW()
                    )
                """)
            print("Audit logs table ready")
        except Exception as e:
            print(f"Database reconnect failed: {e}")
            raise RuntimeError(f"Failed to reconnect database pool: {e}") from e

    return _pool

async def init_db() -> None:
    global _pool
    if _pool is not None:
        try:
            await _pool.close()
        except Exception:
            pass

    _pool = await asyncpg.create_pool(
        dsn=settings.database_url,
        min_size=2,
        max_size=10,
        command_timeout=30,
    )
    print("Database pool initialized")

    async with _pool.acquire() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS ai_audit_logs (
                id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                user_id TEXT NOT NULL,
                username TEXT NOT NULL,
                role TEXT NOT NULL,
                tenant_id TEXT NOT NULL,
                query TEXT NOT NULL,
                tools_used JSONB DEFAULT '[]',
                response_summary TEXT,
                request_id TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        """)
    print("Audit logs table ready")

async def close_db() -> None:
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
        print("Database pool closed")

