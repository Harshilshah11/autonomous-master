from sqlalchemy import Column, String, Text, DateTime, Float
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from .utils import BaseModel, APP_PREFIX


class Mission(BaseModel):
    __tablename__ = f"{APP_PREFIX}_mission"

    name = Column(String(200))
    description = Column(Text, default="")
    status = Column(String(20), default="planned")
    started_at = Column(DateTime(timezone=True), nullable=True)
    ended_at = Column(DateTime(timezone=True), nullable=True)
    waypoint_status = Column(JSONB, default=dict, nullable=False)
    max_cruise_speed = Column(Float, default=0.0)   # m/s; 0 = unset

    waypoints = relationship("Waypoint", back_populates="mission", cascade="all, delete-orphan")

    def __repr__(self):
        return f"{self.name} ({self.status})"
