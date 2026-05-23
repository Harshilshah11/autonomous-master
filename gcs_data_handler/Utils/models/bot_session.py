from sqlalchemy import Column, DateTime, Float, Integer, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from .utils import BaseModel, APP_PREFIX


class BotSession(BaseModel):
    __tablename__ = f"{APP_PREFIX}_botsession"

    bot_id = Column(UUID(as_uuid=True), ForeignKey(f"{APP_PREFIX}_bot.id", ondelete="RESTRICT"), nullable=False)
    started_at = Column(DateTime(timezone=True), nullable=False)
    ended_at = Column(DateTime(timezone=True), nullable=True)
    duration_seconds = Column(Integer, nullable=True)
    distance_meters = Column(Float, nullable=True)

    bot = relationship("Bot", back_populates="sessions")

    def __repr__(self):
        return f"Session bot={self.bot_id} started={self.started_at}"
