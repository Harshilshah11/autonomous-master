from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from .utils import BaseModel, APP_PREFIX


class Waypoint(BaseModel):
    __tablename__ = f"{APP_PREFIX}_waypoint"
    __table_args__ = (
        UniqueConstraint("mission_id", "sequence", name="uq_waypoint_mission_sequence"),
    )

    mission_id = Column(UUID(as_uuid=True), ForeignKey(f"{APP_PREFIX}_mission.id", ondelete="CASCADE"), nullable=False)
    sequence = Column(Integer, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    altitude = Column(Float, default=0.0)
    label = Column(String(100), default="")
    reached_at = Column(DateTime(timezone=True), nullable=True)
    halt = Column(Boolean, default=False)
    halt_seconds = Column(Float, default=0.0)   # 0 = hold until operator resumes

    mission = relationship("Mission", back_populates="waypoints")

    def __repr__(self):
        return f"WP {self.sequence} of {self.mission_id}"
