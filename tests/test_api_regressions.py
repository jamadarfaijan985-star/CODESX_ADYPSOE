import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from backend import main as main_module
from backend.arrival_delay_prediction import ArrivalDelayPredictionInput
from backend.models import ClosureRequest, StationTimetable, Train
from backend.station_profiles import timetable_for_profile, get_station_profile
from backend.validator import validate_timetable


@pytest.fixture(autouse=True)
def isolated_backend_state(monkeypatch):
    """Reset the documented in-memory state for every route-level test."""
    monkeypatch.setattr(main_module, "current_timetable", main_module.create_demo_timetable())
    monkeypatch.setattr(main_module, "schedule_history", [])


def test_default_timetable_and_initial_conflict_are_reported():
    timetable = main_module.get_timetable()
    conflicts = main_module.get_conflicts()

    assert timetable["station"]["id"] == "ST01"
    assert {platform["id"] for platform in timetable["platforms"]} == {"P1", "P2", "P3"}
    assert conflicts["count"] == 1
    assert conflicts["conflicts"][0]["type"] == "OVERLAP"
    assert conflicts["conflicts"][0]["train_ids"] == ["T101", "T102"]


def test_successful_replan_commits_only_independently_validated_schedule():
    result = main_module.replan_schedule(main_module.create_demo_timetable())

    assert result["status"] == "VALID_FOUND"
    assert result["validation"]["valid"] is True
    active = StationTimetable.model_validate(main_module.get_timetable())
    assert validate_timetable(active)["valid"] is True
    assert main_module.get_conflicts()["count"] == 0


def test_infeasible_profile_replan_does_not_replace_active_timetable():
    main_module.replan_schedule(main_module.create_demo_timetable())
    before = main_module.current_timetable.model_dump()

    result = main_module.replan_schedule(
        main_module.create_demo_timetable(),
        station_id="ILLUSTRATIVE-NORTH",
    )

    assert result["status"] == "INFEASIBLE_UNDER_MODEL"
    assert result["schedule"] is None
    assert main_module.current_timetable.model_dump() == before
    assert main_module.current_timetable.station_id == "ST01"


def test_selected_profile_controls_active_platform_constraints():
    profile = get_station_profile("ILLUSTRATIVE-NORTH")
    assert profile is not None
    candidate = timetable_for_profile(
        profile,
        [
            Train(id="T1", arrival=540, departure=550, platform_id="N1"),
            Train(id="T2", arrival=550, departure=560, platform_id="N1"),
        ],
    )

    result = main_module.replan_schedule(candidate, station_id=profile.station_id)

    assert result["status"] == "VALID_FOUND"
    assert main_module.current_timetable.station_id == "ILLUSTRATIVE-NORTH"
    assert {platform.id for platform in main_module.current_timetable.platforms} == {"N1", "N2"}
    assert result["validation"]["valid"] is True


def test_platform_from_another_profile_is_rejected():
    profile = get_station_profile("ILLUSTRATIVE-NORTH")
    assert profile is not None
    candidate = timetable_for_profile(
        profile,
        [Train(id="T1", arrival=540, departure=550, platform_id="N1")],
    )
    main_module.replan_schedule(candidate, station_id=profile.station_id)

    with pytest.raises(HTTPException) as error:
        main_module.apply_platform_closure(
            ClosureRequest(platform_id="P1", start_minute=540, end_minute=570)
        )

    assert error.value.status_code == 404
    assert "P1" in str(error.value.detail)


def test_prediction_does_not_mutate_timetable_or_trigger_replan():
    before_timetable = main_module.current_timetable.model_dump()
    before_history = list(main_module.schedule_history)

    response = main_module.predict_arrival_delay_endpoint(
        ArrivalDelayPredictionInput(
            service_date="2026-08-15",
            seq=10,
            station_code="TVC",
        )
    )

    assert response.experimental is True
    assert response.predicted_delay_minutes >= 0
    assert main_module.current_timetable.model_dump() == before_timetable
    assert main_module.schedule_history == before_history


def test_prediction_invalid_payload_is_rejected_before_handler():
    with pytest.raises(ValidationError):
        ArrivalDelayPredictionInput.model_validate({
            "service_date": "2026-08-15",
            "station_code": "TVC",
        })
