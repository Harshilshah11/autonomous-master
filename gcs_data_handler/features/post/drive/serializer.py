"""drive serializer — parse {speed, direction}; format the reply detail."""

from dataclasses import dataclass


@dataclass
class DriveCommand:
    speed: int
    direction: int


def parse(body: dict) -> DriveCommand:
    """Raise ValueError/TypeError on non-numeric inputs."""
    return DriveCommand(
        speed=int(body.get("speed", 0)),
        direction=int(body.get("direction", 0)),
    )


def reply_detail(cmd: DriveCommand) -> str:
    return f"speed={cmd.speed} dir={cmd.direction}"
