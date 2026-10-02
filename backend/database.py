import os
import socket
from urllib.parse import urlparse
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/bizsaathi")

def is_tcp_port_open(host: str, port: int, timeout: float = 0.8) -> bool:
    """Check if host:port is listening before blocking on a database connection."""
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except (socket.timeout, ConnectionRefusedError, OSError):
        return False

def get_engine():
    """
    Attempts to create an engine with the configured DATABASE_URL.
    If PostgreSQL is unreachable or not configured, falls back to local SQLite
    so the development server and test suite can run seamlessly without throwing fatal startup crashes.
    """
    url = DATABASE_URL
    try:
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql://", 1)

        # Handle PostgreSQL
        if "postgresql" in url:
            # Parse host and port to check if service is alive
            parsed = urlparse(url)
            host = parsed.hostname or "localhost"
            port = parsed.port or 5432

            BASE_DIR = os.path.dirname(os.path.abspath(__file__))
            fallback_db_path = os.path.join(BASE_DIR, "bizsaathi.db").replace("\\", "/")
            fallback_url = f"sqlite:///{fallback_db_path}"

            if not is_tcp_port_open(host, port):
                print(f"[Database Notice] PostgreSQL is not running at {host}:{port}. Using SQLite fallback for local development.")
                return create_engine(fallback_url, connect_args={"check_same_thread": False})

            # Format connection URL for psycopg (v3) if standard postgresql://
            pg_url = url
            if pg_url.startswith("postgresql://") and not pg_url.startswith("postgresql+"):
                try:
                    import psycopg
                    pg_url = pg_url.replace("postgresql://", "postgresql+psycopg://", 1)
                except ImportError:
                    pass

            engine = create_engine(pg_url, pool_pre_ping=True, connect_args={"connect_timeout": 3})
            with engine.connect() as conn:
                pass
            print(f"[Database] Successfully connected to PostgreSQL at {host}:{port}")
            return engine
        else:
            engine = create_engine(url, connect_args={"check_same_thread": False} if "sqlite" in url else {})
            return engine
    except Exception as e:
        print(f"[Database Warning] Could not connect to PostgreSQL ({e}).")
        BASE_DIR = os.path.dirname(os.path.abspath(__file__))
        fallback_db_path = os.path.join(BASE_DIR, "bizsaathi.db").replace("\\", "/")
        fallback_url = f"sqlite:///{fallback_db_path}"
        print(f"[Database] Falling back to SQLite for local development: {fallback_url}")
        return create_engine(fallback_url, connect_args={"check_same_thread": False})

engine = get_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    """FastAPI dependency to yield a database session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    """Create all tables if they do not exist, and ensure schema migrations."""
    from sqlalchemy import text
    Base.metadata.create_all(bind=engine)
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN updated_at TIMESTAMP"))
            conn.commit()
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE conversations ADD COLUMN title VARCHAR(255)"))
            conn.commit()
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN theme VARCHAR(20) DEFAULT 'light'"))
            conn.commit()
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE conversations ADD COLUMN migration_id VARCHAR(100)"))
            conn.commit()
        except Exception:
            pass
