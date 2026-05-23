from datetime import datetime

from sqlalchemy import ( Column, DateTime,func)
from sqlalchemy.orm import  declarative_base
from sqlalchemy.dialects.postgresql import UUID
import uuid



Base = declarative_base()
APP_PREFIX = "apis"

class BaseModel(Base):
    # This makes the model abstract and not mapped to a table.
    __abstract__ = True
    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        unique=True,
        nullable=False,
    )
    created_at = Column(DateTime(timezone=True), default=func.now())
    modified_at = Column(
        DateTime(timezone=True), default=func.now(), onupdate=func.now()
    )

import datetime
from pytz import timezone


IST = timezone('Asia/Kolkata')
def get_kolkata_time():
    return datetime.datetime.now(IST)
