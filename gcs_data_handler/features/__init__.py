"""
features/ — route logic, split by HTTP method.

  features/
    get/<name>/      { resolver.py, serializer.py }
    post/<name>/     { resolver.py, serializer.py }

`resolver.py` is the `Handler` subclass; `serializer.py` does request parsing
and response shaping. `default_handlers()` returns every handler in
registration order — both transports (UART + HTTP) pick them up automatically.
"""

from .get.device_status.resolver import DeviceStatusHandler
from .get.get_home.resolver import GetHomeHandler
from .get.get_missions.resolver import GetMissionsHandler
from .get.mission_status.resolver import MissionStatusHandler
from .get.ping.resolver import PingHandler
from .get.ugv_odometry.resolver import UgvOdometryHandler
from .post.abort_mission.resolver import AbortMissionHandler
from .post.create_new_mission.resolver import CreateNewMissionHandler
from .post.delete_mission.resolver import DeleteMissionHandler
from .post.drive.resolver import DriveHandler
from .post.edit_mission_waypoints.resolver import EditMissionWaypointsHandler
from .post.emergency_stop.resolver import EmergencyStopHandler
from .post.mode.resolver import ModeHandler
from .post.pause_mission.resolver import PauseMissionHandler
from .post.set_home.resolver import SetHomeHandler
from .post.set_mission_cruise_speed.resolver import SetMissionCruiseSpeedHandler
from .post.set_mission_ugv.resolver import SetMissionUgvHandler
from .post.set_return_to_home.resolver import SetReturnToHomeHandler
from .post.start_mission.resolver import StartMissionHandler
from .post.status.resolver import StatusHandler


def default_handlers():
    """All built-in handlers, in registration order."""
    return [
        PingHandler(),
        UgvOdometryHandler(),
        MissionStatusHandler(),
        DeviceStatusHandler(),
        GetMissionsHandler(),
        GetHomeHandler(),
        DriveHandler(),
        ModeHandler(),
        StatusHandler(),
        CreateNewMissionHandler(),
        SetMissionUgvHandler(),
        EditMissionWaypointsHandler(),
        SetMissionCruiseSpeedHandler(),
        DeleteMissionHandler(),
        StartMissionHandler(),
        PauseMissionHandler(),
        AbortMissionHandler(),
        SetHomeHandler(),
        SetReturnToHomeHandler(),
        EmergencyStopHandler(),
    ]
