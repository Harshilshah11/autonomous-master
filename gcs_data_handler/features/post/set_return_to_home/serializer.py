"""set_return_to_home serializer — parse the return-to-home boolean.

Accepts return_to_home / returnToHome / rth as a JSON bool, 0/1, or a
true/false-style string.
"""

_TRUE = {"true", "1", "yes", "on"}
_FALSE = {"false", "0", "no", "off", ""}


def parse(body: dict) -> bool:
    """Return the requested return_to_home bool. Raises ValueError if absent/bad."""
    for key in ("return_to_home", "returnToHome", "rth"):
        if key in body:
            raw = body[key]
            if isinstance(raw, bool):
                return raw
            if isinstance(raw, (int, float)):
                return bool(raw)
            s = str(raw).strip().lower()
            if s in _TRUE:
                return True
            if s in _FALSE:
                return False
            raise ValueError(f"invalid return_to_home value: {raw!r}")
    raise ValueError("missing return_to_home")
