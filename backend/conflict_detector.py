
from backend.models import StationTimetable
from backend.validator import validate_timetable


def detect_conflicts(timetable: StationTimetable) -> list[dict]:
    """Return all timetable constraint violations."""
    result = validate_timetable(timetable)
    return result["violations"]
