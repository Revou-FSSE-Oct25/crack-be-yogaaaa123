"""
CrackPOS AI — Structured Logging with structlog

Provides structured JSON logging for machine readability (production)
and colorful human-readable logging for development.

Replaces bare print() calls throughout the codebase.

FEATURES:
- Production: JSON logs → easy ingestion by log aggregators (Datadog, ELK, etc.)
- Development: Colorful console with timestamps and context
- All logs: level, timestamp, event (message), context (module/function)
- Error logs: full traceback, exception info

Usage:
    from logging_config import get_logger

    logger = get_logger(__name__)
    logger.info("Database pool initialized", pool_size=10)
    logger.error("Connection failed", exc_info=True)
"""
import logging
import os
import sys

import structlog


def setup_logging() -> None:
    """
    Initialize structlog with appropriate configuration based on environment.

    Development (NODE_ENV != production):
        - Console output with colors and timestamps
        - Human-readable format with context

    Production (NODE_ENV == production):
        - JSON output for log aggregation
        - Machine-parseable format
    """
    is_production = os.getenv("NODE_ENV", "") == "production"
    log_level = os.getenv("LOG_LEVEL", "INFO").upper()

    # Konfigurasi shared processors
    shared_processors: list[structlog.typing.Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.dev.set_exc_info,  # auto-include exc_info on error
    ]

    if is_production:
        # Production: JSON output
        shared_processors.append(structlog.processors.format_exc_info)
        shared_processors.append(structlog.processors.JSONRenderer())
    else:
        # Development: colorful console
        shared_processors.append(structlog.dev.ConsoleRenderer(
            colors=True,
            sort_keys=False,
        ))

    structlog.configure(
        processors=shared_processors,
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )

    # Set root logger level
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=getattr(logging, log_level, logging.INFO),
    )


def get_logger(name: str | None = None) -> structlog.stdlib.BoundLogger:
    """
    Get a structlog logger instance.

    Args:
        name: Usually __name__ from the calling module.
              If None, defaults to 'crack-ai'.

    Returns:
        A structlog BoundLogger that can be used like:
            logger.info("event message", key=value, ...)
            logger.error("error message", exc_info=True)
    """
    return structlog.get_logger(name or "crack-ai")
