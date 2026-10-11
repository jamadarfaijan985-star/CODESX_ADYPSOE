
from backend.models import (
    ClosureRequest,
    DelayRequest,
    ReopenRequest,
    StationTimetable,
)
from backend.scheduler import schedule_timetable


def apply_delay(
    timetable: StationTimetable,
    request: DelayRequest,
) -> dict:
    if not any(t.id == request.train_id for t in timetable.trains):
        return {
            "status": "ERROR",
            "message": f"Train {request.train_id} was not found.",
        }

    updated_trains = [
        train.model_copy(
            update={
                "arrival": train.arrival + request.delay_minutes,
                "departure": train.departure + request.delay_minutes,
            }
        )
        if train.id == request.train_id else train
        for train in timetable.trains
    ]

    disrupted = timetable.model_copy(update={"trains": updated_trains})
    result = schedule_timetable(disrupted)

    result["disruption"] = {
        "type": "TRAIN_DELAY",
        "train_id": request.train_id,
        "delay_minutes": request.delay_minutes,
    }
    return result


def apply_closure(
    timetable: StationTimetable,
    request: ClosureRequest,
) -> dict:
    if not any(p.id == request.platform_id for p in timetable.platforms):
        return {
            "status": "ERROR",
            "message": f"Platform {request.platform_id} was not found.",
        }

    updated_platforms = [
        platform.model_copy(
            update={
                "closed_intervals": [
                    *platform.closed_intervals,
                    (request.start_minute, request.end_minute),
                ]
            }
        )
        if platform.id == request.platform_id else platform
        for platform in timetable.platforms
    ]

    disrupted = timetable.model_copy(update={"platforms": updated_platforms})
    result = schedule_timetable(disrupted)

    result["disruption"] = {
        "type": "PLATFORM_CLOSURE",
        "platform_id": request.platform_id,
        "start_minute": request.start_minute,
        "end_minute": request.end_minute,
    }
    return result


def reopen_platform(
    timetable: StationTimetable,
    request: ReopenRequest,
) -> dict:
    platform = next((item for item in timetable.platforms if item.id == request.platform_id), None)
    if platform is None:
        return {
            "status": "ERROR",
            "message": f"Platform {request.platform_id} was not found.",
        }

    ended_intervals = [
        interval for interval in platform.closed_intervals
        if interval[1] <= request.reopen_minute
    ]
    if not ended_intervals:
        latest_end = max((end for _, end in platform.closed_intervals), default=None)
        if latest_end is None:
            return {
                "status": "ERROR",
                "message": f"Platform {request.platform_id} is already open.",
            }
        return {
            "status": "ERROR",
            "message": (
                f"Platform {request.platform_id} cannot reopen at minute "
                f"{request.reopen_minute}; its active closure ends at minute {latest_end}."
            ),
        }

    updated_platforms = [
        item.model_copy(
            update={
                "closed_intervals": [
                    interval for interval in item.closed_intervals
                    if interval not in ended_intervals
                ]
            }
        )
        if item.id == request.platform_id else item
        for item in timetable.platforms
    ]
    reopened = timetable.model_copy(update={"platforms": updated_platforms})
    result = schedule_timetable(reopened)
    result["disruption"] = {
        "type": "PLATFORM_REOPEN",
        "platform_id": request.platform_id,
        "reopen_minute": request.reopen_minute,
    }
    return result
