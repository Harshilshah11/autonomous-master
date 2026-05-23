from .utils import BaseModel , get_kolkata_time
from .utils import APP_PREFIX
from sqlalchemy import (ARRAY, Boolean, Column, Date, DateTime, Float,
                        ForeignKey, Integer, Numeric, String, create_engine,
                        func, Enum, DECIMAL,JSON)
from sqlalchemy.orm import relationship
class User(BaseModel):
    tablename = f"{APP_PREFIX}_user"
    __tablename__ = tablename
    email = Column(String, unique=True)
    first_name = Column(String(500))
    last_name = Column(String(500))
    is_active = Column(Boolean, default=True)
    is_staff = Column(Boolean, default=False)
    date_joined = Column(DateTime, default=get_kolkata_time)
    balance = Column(Numeric(25, 8), default=100000)
    username = Column(String(30), unique=True)
    profile_image = Column(String(1000), default="profile.jpg")
    profile_description = Column(String(500), default="")
    otp_token = Column(String(256), default="")



    def __repr__(self):
        return self.email

