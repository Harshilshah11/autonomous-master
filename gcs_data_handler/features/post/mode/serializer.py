"""mode serializer — extract botMode string."""


def parse(body: dict) -> str:
    return str(body.get("botMode") or "").strip()
