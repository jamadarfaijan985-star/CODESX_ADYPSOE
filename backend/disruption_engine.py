
from backend.models import (
    ClosureRequest,
    DelayRequest,
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
