import os
from pathlib import Path
from dotenv import dotenv_values
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Look for a .env in any reasonable location: this package's parent dirs
# (handles both `gcs_data_handler/Utils/models` and the repo root) and the cwd.
_here = Path(__file__).resolve()
_candidates = [
    _here.parent.parent.parent / ".env",   # service dir (e.g. gcs_data_handler/.env)
    _here.parent.parent.parent.parent / ".env",  # repo root
    Path.cwd() / ".env",
]
_env_file = next((p for p in _candidates if p.is_file()), None)
_env = dotenv_values(_env_file) if _env_file else {}

def _cfg(key: str, default: str) -> str:
    # os.environ wins (Docker env_file / compose `environment:` inject here),
    # then the .env file, then the hard-coded default.
    return os.environ.get(key) or _env.get(key) or default

IN_DOCKER = _cfg("IN_DOCKER", "false").lower() == "true"
HOST = _cfg("HOST", "db" if IN_DOCKER else "127.0.0.1")
NAME = _cfg("NAME", "arnobot_gcs_db")
USER = _cfg("USER", "arnobot")
PASSWORD = _cfg("PASSWORD", "arnobot_password")
PORT = _cfg("PORT", "5432")

database_connection_string = f"postgresql://{USER}:{PASSWORD}@{HOST}:{PORT}/{NAME}"

engine = create_engine(database_connection_string, pool_size=40, max_overflow=10)
Session = sessionmaker(bind=engine)
session = Session()

Base = declarative_base()

from .user import User
from .bot import Bot
from .mission import Mission
from .bot_session import BotSession
from .ugv_telemetry import UGVTelemetry
from .waypoint import Waypoint
