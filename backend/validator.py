
from itertools import combinations

from backend.models import StationTimetable


def validate_timetable(timetable: StationTimetable) -> dict:
    """Independently check platform, timing, closure and clearance constraints."""

    violations = []
    platform_ids = {platform.id for platform in timetable.platforms}
    platform_map = {platform.id: platform for platform in timetable.platforms}

    # Check each train's platform and timing.
    for train in timetable.trains:
        if train.platform_id not in platform_ids:
            violations.append({
                "type": "UNKNOWN_PLATFORM",
                "train_id": train.id,
                "message": f"{train.id} uses unknown platform {train.platform_id}.",
            })
            continue

        if (
            train.mandatory_platform_id is not None
            and train.platform_id != train.mandatory_platform_id
        ):
            violations.append({
                "type": "MANDATORY_PLATFORM",
                "train_id": train.id,
                "message": (
                    f"{train.id} must use platform "
                    f"{train.mandatory_platform_id}."
                ),
            })

        platform = platform_map[train.platform_id]

        for start, end in platform.closed_intervals:
            if train.arrival < end and train.departure > start:
                violations.append({
                    "type": "PLATFORM_CLOSED",
                    "train_id": train.id,
                    "platform_id": train.platform_id,
                    "message": (
                        f"{train.id} overlaps a closure on "
                        f"{train.platform_id}."
                    ),
                })

    # Pairwise checks: do not reuse the scheduler's assignment logic.
    for first, second in combinations(timetable.trains, 2):
        if first.platform_id != second.platform_id:
            continue

        # Order the two trains by arrival time.
        earlier, later = sorted(
            (first, second),
            key=lambda train: train.arrival,
        )

        actual_gap = later.arrival - earlier.departure

        if actual_gap < 0:
            violations.append({
                "type": "OVERLAP",
                "platform_id": earlier.platform_id,
                "train_ids": [earlier.id, later.id],
                "message": (
                    f"{earlier.id} and {later.id} overlap on "
                    f"{earlier.platform_id}."
                ),
            })
        elif actual_gap < timetable.minimum_gap_minutes:
            violations.append({
                "type": "MINIMUM_GAP",
                "platform_id": earlier.platform_id,
                "train_ids": [earlier.id, later.id],
                "actual_gap_minutes": actual_gap,
                "required_gap_minutes": timetable.minimum_gap_minutes,
                "message": (
                    f"{earlier.id} and {later.id} have only "
                    f"{actual_gap} minutes between them; "
                    f"{timetable.minimum_gap_minutes} required."
                ),
            })

    return {
        "status": "PASS" if not violations else "FAIL",
        "valid": not violations,
        "violations": violations,
        "violation_count": len(violations),
    }
