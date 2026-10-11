import pytest
from pydantic import ValidationError

from backend.main import app, create_demo_timetable
from backend.disruption_engine import apply_delay
from backend.models import DelayRequest, Platform, StationProfile, StationTimetable, Train
from backend.scheduler import schedule_timetable
from backend.station_profiles import (
    get_station_profile,
    list_station_profiles,
    timetable_for_profile,
)
from backend.validator import validate_timetable


def test_profiles_include_fictional_default_and_illustrative_profiles():
    profiles = list_station_profiles()
    ids = {profile.station_id for profile in profiles}

    assert "ST01" in ids
    assert get_station_profile("ST01").display_name == "Central Junction"
    assert any(profile.illustrative for profile in profiles if profile.station_id != "ST01")


def test_invalid_profile_configuration_is_rejected():
    with pytest.raises(ValidationError):
        StationProfile(
            station_id="BAD",
            display_name="Bad Profile",
            platforms=[Platform(id="P1"), Platform(id="P1")],
        )

    with pytest.raises(ValidationError):
        Platform(id="P1", availability_intervals=[(600, 500)])


def test_profile_materializes_all_constraints_into_one_timetable():
    profile = StationProfile(
        station_id="TEST",
        display_name="Test Station",
        minimum_gap_minutes=7,
        platforms=[
            Platform(
                id="A",
                supported_train_ids=["T1"],
                availability_intervals=[(500, 600)],
            ),
            Platform(id="B"),
        ],
    )
    timetable = timetable_for_profile(
        profile,
        [Train(id="T1", arrival=540, departure=550, platform_id="B")],
    )

    assert timetable.station_id == "TEST"
    assert timetable.station_name == "Test Station"
    assert timetable.station_illustrative is False
    assert timetable.minimum_gap_minutes == 7
    assert timetable.platforms[0].supported_train_ids == ["T1"]


def test_selected_profile_is_used_by_scheduler_and_validator():
    profile = StationProfile(
        station_id="TEST",
        display_name="Test Station",
        platforms=[Platform(id="A", supported_train_ids=["T1"])],
    )
    timetable = timetable_for_profile(
        profile,
        [Train(id="T1", arrival=540, departure=550, platform_id="A")],
    )

    result = schedule_timetable(timetable)

    assert result["status"] == "VALID_FOUND"
    revised = StationTimetable.model_validate(result["schedule"])
    assert validate_timetable(revised)["valid"] is True


def test_validator_reports_profile_compatibility_violation():
    profile = StationProfile(
        station_id="TEST",
        display_name="Test Station",
        platforms=[Platform(id="A", supported_train_ids=["T2"])],
    )
    timetable = timetable_for_profile(
        profile,
        [Train(id="T1", arrival=540, departure=550, platform_id="A")],
    )

    validation = validate_timetable(timetable)

    assert validation["valid"] is False
    assert any(
        violation["type"] == "PLATFORM_NOT_SUPPORTED"
        for violation in validation["violations"]
    )


def test_profile_disruption_replan_keeps_station_constraints():
    profile = StationProfile(
        station_id="TEST",
        display_name="Test Station",
        minimum_gap_minutes=7,
        platforms=[Platform(id="A"), Platform(id="B")],
    )
    timetable = timetable_for_profile(
        profile,
        [
            Train(id="T1", arrival=540, departure=550, platform_id="A"),
            Train(id="T2", arrival=550, departure=560, platform_id="A"),
        ],
    )

    result = apply_delay(timetable, DelayRequest(train_id="T2", delay_minutes=15))

    assert result["status"] == "VALID_FOUND"
    revised = StationTimetable.model_validate(result["schedule"])
    assert revised.station_id == "TEST"
    assert revised.minimum_gap_minutes == 7
    assert validate_timetable(revised)["valid"] is True


def test_demo_timetable_still_uses_fictional_station_profile():
    timetable = create_demo_timetable()

    assert timetable.station_id == "ST01"
    assert timetable.station_name == "Central Junction"
    assert timetable.station_illustrative is False
    assert {platform.id for platform in timetable.platforms} == {"P1", "P2", "P3"}
    assert {route.path for route in app.routes} >= {
        "/api/stations/profiles",
        "/api/stations/profiles/{station_id}",
    }
