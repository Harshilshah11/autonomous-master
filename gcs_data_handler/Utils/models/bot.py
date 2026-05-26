from sqlalchemy import BigInteger, Boolean, Column, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from .utils import BaseModel, APP_PREFIX


class Bot(BaseModel):
    __tablename__ = f"{APP_PREFIX}_bot"

    name = Column(String(100), default="")
    bot_type = Column(String(20), default="UGV")
    status = Column(String(20), default="active")
    description = Column(Text, default="")
    mode = Column(Text, default="")

    x = Column(Float, default=0.0)
    y = Column(Float, default=0.0)
    lat = Column(Float, default=0.0)
    long = Column(Float, default=0.0)
    battery_volt = Column(Float, default=0.0)

    uptime_ms = Column(BigInteger, default=0)
    yaw = Column(Float, default=0.0)
    vx = Column(Float, default=0.0)
    gps_fix = Column(String(10), default="")
    satellites = Column(Integer, default=0)
    sigma_x = Column(Float, default=0.0)
    sigma_y = Column(Float, default=0.0)
    telemetry_rate_hz = Column(Float, default=0.0)

    input_speed = Column(Float, default=0.0)
    input_steer = Column(Float, default=0.0)

    home_coordinates = Column(JSONB, default=dict, nullable=False)   # {"lat":..,"lng":..}
    return_to_home = Column(Boolean, default=False)

    mission_id = Column(UUID(as_uuid=True),
                        ForeignKey(f"{APP_PREFIX}_mission.id", ondelete="SET NULL"),
                        nullable=True)

    sessions = relationship("BotSession", back_populates="bot")
    telemetry = relationship("UGVTelemetry", back_populates="bot")
    mission = relationship("Mission")

    def __repr__(self):
        return f"Bot {self.id} ({self.bot_type})"
