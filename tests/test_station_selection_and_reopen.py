import pytest
from fastapi import HTTPException

from backend import main as main_module
from backend.models import ClosureRequest, ReopenRequest, StationSelectionRequest
from backend.validator import validate_timetable


@pytest.fixture(autouse=True)
def isolated_backend_state(monkeypatch):
    monkeypatch.setattr(main_module, "current_timetable", main_module.create_demo_timetable())
    monkeypatch.setattr(main_module, "schedule_history", [])


def test_station_selection_uses_backend_owned_profile_and_seed_timetable():
    result = main_module.select_station(
        StationSelectionRequest(station_id="ILLUSTRATIVE-NORTH")
    )

    assert result["status"] == "VALID_FOUND"
    assert result["schedule"]["station_id"] == "ILLUSTRATIVE-NORTH"
    assert {platform["id"] for platform in result["schedule"]["platforms"]} == {"N1", "N2"}
    assert result["validation"]["valid"] is True
    assert validate_timetable(main_module.current_timetable)["valid"] is True


def test_unknown_station_selection_does_not_change_active_timetable():
    before = main_module.current_timetable.model_dump()

    with pytest.raises(HTTPException) as error:
        main_module.select_station(StationSelectionRequest(station_id="UNKNOWN"))

    assert error.value.status_code == 404
    assert main_module.current_timetable.model_dump() == before


def test_platform_reopen_requires_closure_to_have_ended_and_revalidates():
    closure = main_module.apply_platform_closure(
        ClosureRequest(platform_id="P1", start_minute=540, end_minute=570)
    )
    assert closure["status"] == "VALID_FOUND"
    assert main_module.current_timetable.platforms[0].closed_intervals == [(540, 570)]

    with pytest.raises(HTTPException) as early_error:
        main_module.reopen_closed_platform(
            ReopenRequest(platform_id="P1", reopen_minute=569)
        )
    assert early_error.value.status_code == 409
    assert main_module.current_timetable.platforms[0].closed_intervals == [(540, 570)]

    reopened = main_module.reopen_closed_platform(
        ReopenRequest(platform_id="P1", reopen_minute=570)
    )
    assert reopened["status"] == "VALID_FOUND"
    assert reopened["validation"]["valid"] is True
    assert main_module.current_timetable.platforms[0].closed_intervals == []
    assert validate_timetable(main_module.current_timetable)["valid"] is True
