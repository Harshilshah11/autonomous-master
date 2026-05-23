from sqlalchemy import BigInteger, Boolean, Column, DateTime, Float, Integer, JSON, String, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from .utils import Base, APP_PREFIX


class UGVTelemetry(Base):
    """Immutable time-series rows — no BaseModel (uses BigInteger PK, no modified_at)."""
    __tablename__ = f"{APP_PREFIX}_ugvtelemetry"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    bot_id = Column(UUID(as_uuid=True), ForeignKey(f"{APP_PREFIX}_bot.id", ondelete="RESTRICT"), nullable=False)
    bot_session_id = Column(UUID(as_uuid=True), ForeignKey(f"{APP_PREFIX}_botsession.id", ondelete="CASCADE"), nullable=True)

    timestamp = Column(DateTime(timezone=True), nullable=False)
    received_at = Column(DateTime(timezone=True))

    speed = Column(Float, default=0.0)
    rc_status = Column(Boolean, default=False)
    temperature = Column(Float, default=0.0)
    battery_capacity = Column(Integer, default=0)
    mode = Column(String(50), default="")

    encoder_m1 = Column(Float, default=0.0)
    encoder_m2 = Column(Float, default=0.0)
    encoder_m3 = Column(Float, default=0.0)
    encoder_m4 = Column(Float, default=0.0)

    imu_roll = Column(Float, default=0.0)
    imu_pitch = Column(Float, default=0.0)
    imu_yaw = Column(Float, default=0.0)

    latitude = Column(Float, default=0.0)
    longitude = Column(Float, default=0.0)
    altitude = Column(Float, default=0.0)
    satellites = Column(Integer, default=0)

    power_m1_v = Column(Float, default=0.0)
    power_m1_i = Column(Float, default=0.0)
    power_m2_v = Column(Float, default=0.0)
    power_m2_i = Column(Float, default=0.0)
    power_m3_v = Column(Float, default=0.0)
    power_m3_i = Column(Float, default=0.0)
    power_m4_v = Column(Float, default=0.0)
    power_m4_i = Column(Float, default=0.0)

    sensor_us1 = Column(Float, default=0.0)
    sensor_us2 = Column(Float, default=0.0)
    sensor_us3 = Column(Float, default=0.0)
    sensor_us4 = Column(Float, default=0.0)

    extras = Column(JSON, default=dict)

    bot = relationship("Bot", back_populates="telemetry")

    def __repr__(self):
        return f"Telemetry bot={self.bot_id} @ {self.timestamp}"
