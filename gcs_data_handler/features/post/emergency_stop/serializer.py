"""emergency_stop serializer — no request params; format the reply detail.

Emergency stop takes no body. It is shaped as a function so the route follows
the same serializer/resolver split as every other feature.
"""

#: Status string written to Bot.status when an e-stop is issued.
ESTOP_STATUS = "emergency_stop"


def reply_detail() -> str:
    return "emergency stop engaged: mode=MANUAL, inputs zeroed, RTH cleared"
