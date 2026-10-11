from backend.ai_parser import parse_disruption
from backend.disruption_engine import apply_closure, apply_delay
from backend.main import create_demo_timetable
from backend.models import ClosureRequest, DelayRequest, Platform, StationTimetable, Train
from backend.validator import validate_timetable


def test_demo_delay_replans_and_validates():
    result = apply_delay(
        create_demo_timetable(),
        DelayRequest(train_id="T102", delay_minutes=15),
    )

    assert result["status"] == "VALID_FOUND"
    assert result["validation"]["valid"] is True
    revised = StationTimetable.model_validate(result["schedule"])
    delayed = next(train for train in revised.trains if train.id == "T102")
    assert (delayed.arrival, delayed.departure) == (565, 580)
    assert validate_timetable(revised)["valid"] is True


def test_unknown_train_does_not_change_timetable():
    timetable = create_demo_timetable()
    result = apply_delay(timetable, DelayRequest(train_id="UNKNOWN", delay_minutes=15))

    assert result == {"status": "ERROR", "message": "Train UNKNOWN was not found."}
    assert timetable == create_demo_timetable()


def test_demo_closure_replans_away_from_closed_platform():
    result = apply_closure(
        create_demo_timetable(),
        ClosureRequest(platform_id="P1", start_minute=540, end_minute=570),
    )

    assert result["status"] == "VALID_FOUND"
    revised = StationTimetable.model_validate(result["schedule"])
    assert validate_timetable(revised)["valid"] is True
    assert all(
        train.platform_id != "P1"
        for train in revised.trains
        if train.arrival < 570 and train.departure > 540
    )


def test_unknown_platform_does_not_change_timetable():
    timetable = create_demo_timetable()
    result = apply_closure(
        timetable,
        ClosureRequest(platform_id="UNKNOWN", start_minute=540, end_minute=570),
    )

    assert result["status"] == "ERROR"
    assert "UNKNOWN" in result["message"]
    assert timetable == create_demo_timetable()


def test_parser_distinguishes_parsed_and_missing_closure_details():
    assert parse_disruption("T102 is delayed by 15 minutes") == {
        "status": "PARSED",
        "type": "TRAIN_DELAY",
        "train_id": "T102",
        "delay_minutes": 15,
        "requires_confirmation": True,
    }
    assert parse_disruption("Platform P1 is closed")["status"] == "NEEDS_DETAILS"

    parsed = parse_disruption("Platform P1 is closed from 540 to 570")
    assert parsed["status"] == "PARSED"
    assert parsed["start_minute"] == 540
    assert parsed["end_minute"] == 570


def test_parser_does_not_accept_zero_delay_or_reverse_closure():
    assert parse_disruption("T102 is delayed by 0 minutes")["status"] == "NEEDS_CLARIFICATION"
    invalid = parse_disruption("Platform P1 is closed from 570 to 540")
    assert invalid["status"] == "NEEDS_DETAILS"


def test_impossible_closure_is_reported_without_a_schedule():
    timetable = StationTimetable(
        minimum_gap_minutes=5,
        platforms=[Platform(id="P1")],
        trains=[Train(id="T1", arrival=540, departure=550, platform_id="P1")],
    )
    result = apply_closure(
        timetable,
        ClosureRequest(platform_id="P1", start_minute=540, end_minute=550),
    )

    assert result["status"] == "INFEASIBLE_UNDER_MODEL"
    assert result["schedule"] is None
    assert "No valid assignment" in result["message"]
