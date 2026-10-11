
from backend.models import StationTimetable, Train
from backend.validator import validate_timetable


def schedule_timetable(timetable: StationTimetable) -> dict:
    """
    Find a valid platform assignment using backtracking.

    Every complete candidate is independently checked by the validator.
    The input timetable is not modified.
    """

    platforms = [platform.id for platform in timetable.platforms]
    platform_map = {platform.id: platform for platform in timetable.platforms}

    # Preserve mandatory assignments and schedule more constrained trains first.
    trains = sorted(
        timetable.trains,
        key=lambda train: (
            train.mandatory_platform_id is None,
            train.arrival,
            train.id,
        ),
    )

    assigned = {}
    nodes_examined = 0

    def compatible(train, platform_id):
        platform = platform_map[platform_id]

        # Mandatory platform constraint.
        if (
            train.mandatory_platform_id is not None
            and train.mandatory_platform_id != platform_id
        ):
            return False

        # Platform closure constraint.
        for start, end in platform.closed_intervals:
            if train.arrival < end and train.departure > start:
                return False

        if (
            platform.supported_train_ids is not None
            and train.id not in platform.supported_train_ids
        ):
            return False

        if platform.availability_intervals and not any(
            train.arrival >= start and train.departure <= end
            for start, end in platform.availability_intervals
        ):
            return False

        # Check the assignment against every already assigned train.
        for other in assigned.values():
            if other.platform_id != platform_id:
                continue

            # Half-open occupancy intervals [arrival, departure).
            gap = max(
                other.arrival - train.departure,
                train.arrival - other.departure,
            )

            if gap < timetable.minimum_gap_minutes:
                return False

        return True

    def search(index):
        nonlocal nodes_examined
        nodes_examined += 1

        if index == len(trains):
            candidate_trains = [
                train.model_copy(
                    update={"platform_id": assigned[train.id].platform_id}
                )
                for train in timetable.trains
            ]

            candidate = timetable.model_copy(
                update={"trains": candidate_trains}
            )

            # Never accept a candidate without independent validation.
            validation = validate_timetable(candidate)

            if validation["valid"]:
                return candidate, validation

            return None, validation

        train = trains[index]

        # A mandatory train has only one eligible platform.
        candidates = (
            [train.mandatory_platform_id]
            if train.mandatory_platform_id is not None
            else platforms
        )

        for platform_id in candidates:
            if platform_id not in platform_map:
                continue

            if not compatible(train, platform_id):
                continue

            assigned[train.id] = train.model_copy(
                update={"platform_id": platform_id}
            )

            result, validation = search(index + 1)

            if result is not None:
                return result, validation

            del assigned[train.id]

        return None, None

    # Duplicate IDs make the assignment map ambiguous.
    train_ids = [train.id for train in timetable.trains]
    if len(train_ids) != len(set(train_ids)):
        return {
            "status": "ERROR",
            "message": "Train IDs must be unique.",
            "schedule": None,
            "validation": None,
        }

    result, validation = search(0)

    if result is None:
        return {
            "status": "INFEASIBLE_UNDER_MODEL",
            "message": (
                "No valid assignment exists for the current constraints "
                "and available platforms."
            ),
            "schedule": None,
            "validation": None,
            "nodes_examined": nodes_examined,
        }

    return {
        "status": "VALID_FOUND",
        "message": "A candidate schedule passed independent validation.",
        "schedule": result.model_dump(),
        "validation": validation,
        "nodes_examined": nodes_examined,
    }
