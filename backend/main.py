
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from backend.models import (
    StationTimetable,
    Platform,
    Train,
    DelayRequest,
    ClosureRequest,
    DisruptionTextRequest,
)
from backend.validator import validate_timetable
from backend.conflict_detector import detect_conflicts
from backend.scheduler import schedule_timetable
from backend.disruption_engine import apply_delay, apply_closure
from backend.ai_parser import parse_disruption
from backend.arrival_delay_prediction import (
    ArrivalDelayModelError,
    ArrivalDelayPredictionInput,
    ArrivalDelayPredictionResponse,
    predict_arrival_delay,
)
from backend.station_profiles import (
    get_station_profile,
    list_station_profiles,
    timetable_for_profile,
)

app = FastAPI(
    title="RailFlow API",
    description="Constraint-based railway platform scheduling and disruption management",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def create_demo_timetable() -> StationTimetable:
    profile = get_station_profile("ST01")
    assert profile is not None
    return timetable_for_profile(
        profile,
        trains=[
            Train(
                id="T101",
                arrival=540,
                departure=555,
                platform_id="P1",
            ),
            Train(
                id="T102",
                arrival=550,
                departure=565,
                platform_id="P1",
            ),
            Train(
                id="T103",
                arrival=560,
                departure=575,
                platform_id="P2",
                mandatory_platform_id="P2",
            ),
            Train(
                id="T104",
                arrival=580,
                departure=595,
                platform_id="P1",
            ),
            Train(
                id="T105",
                arrival=590,
                departure=605,
                platform_id="P2",
            ),
        ],
    )


# Local in-memory state: resets when the server restarts.
current_timetable = create_demo_timetable()
schedule_history = []


def timetable_response(timetable: StationTimetable) -> dict:
    return {
        "station": {
            "id": timetable.station_id,
            "name": timetable.station_name,
            "fictional": timetable.station_id == "ST01",
            "illustrative": timetable.station_illustrative,
        },
        **timetable.model_dump(),
    }


def remember_result(result: dict) -> dict:
    global current_timetable

    if result.get("status") == "VALID_FOUND":
        # Treat the validator as the commit gate as well as the scheduler's
        # candidate check. This protects in-memory state if another caller
        # supplies a malformed or stale VALID_FOUND result.
        proposed = StationTimetable.model_validate(result["schedule"])
        validation = validate_timetable(proposed)
        if not validation["valid"]:
            result = {
                **result,
                "status": "ERROR",
                "message": "The proposed schedule failed independent validation.",
                "validation": validation,
            }
        else:
            current_timetable = proposed
    schedule_history.append(result)
    return result


@app.get("/")
def root():
    return {"message": "RailFlow API is running", "status": "success"}


@app.get("/api/health")
def health():
    return {"status": "healthy", "service": "RailFlow backend"}


@app.get("/api/stations/profiles")
def get_station_profiles():
    return {"profiles": [profile.model_dump() for profile in list_station_profiles()]}


@app.get("/api/stations/profiles/{station_id}")
def get_station_profile_details(station_id: str):
    profile = get_station_profile(station_id)
    if profile is None:
        raise HTTPException(status_code=404, detail=f"Station profile {station_id} was not found.")
    return profile.model_dump()


@app.get("/api/timetable")
def get_timetable():
    return timetable_response(current_timetable)


@app.get("/api/conflicts")
def get_conflicts():
    conflicts = detect_conflicts(current_timetable)
    return {"conflicts": conflicts, "count": len(conflicts)}


@app.post("/api/schedule/validate")
def validate_schedule(timetable: StationTimetable, station_id: str | None = None):
    if station_id is not None:
        profile = get_station_profile(station_id)
        if profile is None:
            raise HTTPException(status_code=404, detail=f"Station profile {station_id} was not found.")
        timetable = timetable_for_profile(profile, timetable.trains)
    return validate_timetable(timetable)


@app.post("/api/schedule/replan")
def replan_schedule(timetable: StationTimetable, station_id: str | None = None):
    selected_station_id = station_id or timetable.station_id
    profile = get_station_profile(selected_station_id)
    if profile is None:
        raise HTTPException(status_code=404, detail=f"Station profile {selected_station_id} was not found.")
    timetable = timetable_for_profile(profile, timetable.trains)
    result = schedule_timetable(timetable)
    return remember_result(result)


@app.post("/api/disruptions/delay")
def apply_train_delay(request: DelayRequest):
    result = apply_delay(current_timetable, request)

    if result.get("status") == "ERROR":
        raise HTTPException(status_code=404, detail=result["message"])

    return remember_result(result)


@app.post("/api/disruptions/closure")
def apply_platform_closure(request: ClosureRequest):
    result = apply_closure(current_timetable, request)

    if result.get("status") == "ERROR":
        raise HTTPException(status_code=404, detail=result["message"])

    return remember_result(result)


@app.post("/api/disruptions/parse")
def parse_disruption_request(request: DisruptionTextRequest):
    return parse_disruption(request.text)


@app.post(
    "/api/predictions/arrival-delay",
    response_model=ArrivalDelayPredictionResponse,
)
def predict_arrival_delay_endpoint(request: ArrivalDelayPredictionInput):
    try:
        return predict_arrival_delay(request)
    except ArrivalDelayModelError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.get("/api/schedule/history")
def get_schedule_history():
    return {"runs": schedule_history, "count": len(schedule_history)}
