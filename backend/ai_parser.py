
import re


def parse_disruption(text: str) -> dict:
    text = text.strip()

    delay_match = re.search(
        r"\b(?:train\s+)?([A-Za-z]\w*)\s+"
        r"(?:is\s+)?delayed\s+by\s+([1-9]\d*)\s+minutes?\b",
        text,
        re.IGNORECASE,
    )

    if delay_match:
        return {
            "status": "PARSED",
            "type": "TRAIN_DELAY",
            "train_id": delay_match.group(1).upper(),
            "delay_minutes": int(delay_match.group(2)),
            "requires_confirmation": True,
        }

    closure_match = re.search(
        r"\bplatform\s+([A-Za-z]?\d+)\s+"
        r"(?:is\s+)?(?:closed|unavailable)\b"
        r"(?:\s+(?:from|between)\s+(\d+)\s+"
        r"(?:to|and)\s+(\d+))?",
        text,
        re.IGNORECASE,
    )

    if closure_match:
        start_minute = closure_match.group(2)
        end_minute = closure_match.group(3)

        if start_minute is not None and end_minute is not None:
            start = int(start_minute)
            end = int(end_minute)
            if end <= start:
                return {
                    "status": "NEEDS_DETAILS",
                    "type": "PLATFORM_CLOSURE",
                    "platform_id": closure_match.group(1).upper(),
                    "message": "Closure end time must be after its start time.",
                    "requires_confirmation": True,
                }

            return {
                "status": "PARSED",
                "type": "PLATFORM_CLOSURE",
                "platform_id": closure_match.group(1).upper(),
                "start_minute": start,
                "end_minute": end,
                "requires_confirmation": True,
            }

        return {
            "status": "NEEDS_DETAILS",
            "type": "PLATFORM_CLOSURE",
            "platform_id": closure_match.group(1).upper(),
            "message": "Please provide the closure start and end times.",
            "requires_confirmation": True,
        }

    return {
        "status": "NEEDS_CLARIFICATION",
        "message": (
            "Could not confidently parse this disruption. "
            "Specify a train ID and delay, or a platform and closure interval."
        ),
        "requires_confirmation": True,
    }
