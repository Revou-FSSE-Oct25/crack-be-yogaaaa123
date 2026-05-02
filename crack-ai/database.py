"""
CrackPOS AI — Database Connection (asyncpg)
Connection pool to PostgreSQL, same as NestJS backend.

AUTO-RECONNECT: The get_pool() function will attempt to re-create the pool
if it detects the pool has been closed (e.g., after a database restart).
This prevents the AI service from crashing when the database recycles connections.
"""
import asyncpg
from config import settings

# Global connection pool — created at startup
_pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    """Get the connection pool.

    AUTO-RECONNECT: If the pool was initialized but is now closed
    (e.g., after a database restart or network interruption), this
    function will automatically re-create the pool.

    This prevents the entire AI service from going down when the
    database temporarily disconnects — the pool is re-established
    on the next tool call.

    Returns:
        asyncpg.Pool: An active database connection pool.

    Raises:
        RuntimeError: If init_db() has never been called yet.
    """
    global _pool

    # Pool belum pernah diinisialisasi sama sekali
    if _pool is None:
        raise RuntimeError("Database pool not initialized. Call init_db() first.")

    # Coba cek apakah pool masih hidup dengan mengambil koneksi
    try:
        # acquire() akan raise exception kalau pool sudah closed
        async with _pool.acquire() as conn:
            # Test query cepat untuk verifikasi koneksi benar-benar hidup
            await conn.execute("SELECT 1")
    except (asyncpg.InterfaceError, asyncpg.PostgresError, ConnectionError, OSError):
        # Pool mati / koneksi terputus — coba reconnect
        print("⚠️ Database pool connection lost. Attempting to reconnect...")
        try:
            # Tutup pool lama kalau masih ada
            try:
                await _pool.close()
            except Exception:
                pass  # Pool sudah mati, abaikan error close

            # Buat pool baru
            _pool = await asyncpg.create_pool(
                dsn=settings.database_url,
                min_size=2,
                max_size=10,
                command_timeout=30,
            )
            print("✅ Database pool reconnected successfully")
        except Exception as e:
            print(f"❌ Database reconnect failed: {e}")
            # Lempar ulang exception — lebih baik dari pada lanjut dengan pool mati
            raise RuntimeError(f"Failed to reconnect database pool: {e}") from e

    return _pool


async def init_db() -> None:
    """
    Initialize asyncpg connection pool.
    Called during FastAPI startup (lifespan).
    """
    global _pool
    if _pool is not None:
        # Safety: tutup pool lama sebelum bikin baru (mencegah memory leak)
        try:
            await _pool.close()
        except Exception:
            pass

    _pool = await asyncpg.create_pool(
        dsn=settings.database_url,
        min_size=2,
        max_size=10,
        command_timeout=30,  # 30 second timeout per query
    )
    print("✅ Database pool initialized")


async def close_db() -> None:
    """Close the connection pool on shutdown."""
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
        print("🔌 Database pool closed")
