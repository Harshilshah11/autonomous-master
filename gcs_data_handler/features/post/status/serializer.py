"""status serializer — extract armStatus string."""


def parse(body: dict) -> str:
    return str(body.get("armStatus") or "").strip()
