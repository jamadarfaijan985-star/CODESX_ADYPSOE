
from backend.models import Platform, StationTimetable, Train
from backend.validator import validate_timetable


def make_timetable(trains, platforms=None, minimum_gap=5):
    return StationTimetable(
        minimum_gap_minutes=minimum_gap,
        platforms=platforms or [Platform(id="P1"), Platform(id="P2")],
        trains=trains,
    )


def test_valid_timetable_passes():
    timetable = make_timetable([
        Train(id="T1", arrival=540, departure=550, platform_id="P1"),
        Train(id="T2", arrival=555, departure=565, platform_id="P1"),
    ])

    result = validate_timetable(timetable)

    assert result["status"] == "PASS"
    assert result["valid"] is True
    assert result["violations"] == []


def test_overlapping_trains_fail():
    timetable = make_timetable([
        Train(id="T1", arrival=540, departure=560, platform_id="P1"),
        Train(id="T2", arrival=550, departure=570, platform_id="P1"),
    ])

    result = validate_timetable(timetable)

    assert result["status"] == "FAIL"
    assert any(v["type"] == "OVERLAP" for v in result["violations"])


def test_insufficient_minimum_gap_fails():
    timetable = make_timetable([
        Train(id="T1", arrival=540, departure=550, platform_id="P1"),
        Train(id="T2", arrival=553, departure=563, platform_id="P1"),
    ], minimum_gap=5)

    result = validate_timetable(timetable)

    assert result["status"] == "FAIL"
    assert any(v["type"] == "MINIMUM_GAP" for v in result["violations"])


def test_closed_platform_fails():
    timetable = make_timetable(
        trains=[
            Train(id="T1", arrival=540, departure=560, platform_id="P1"),
        ],
        platforms=[
            Platform(id="P1", closed_intervals=[(550, 570)]),
            Platform(id="P2"),
        ],
    )

    result = validate_timetable(timetable)

    assert result["status"] == "FAIL"
    assert any(v["type"] == "PLATFORM_CLOSED" for v in result["violations"])


def test_mandatory_platform_violation_fails():
    timetable = make_timetable([
        Train(
            id="T1",
            arrival=540,
            departure=550,
            platform_id="P2",
            mandatory_platform_id="P1",
        ),
    ])

    result = validate_timetable(timetable)

    assert result["status"] == "FAIL"
    assert any(v["type"] == "MANDATORY_PLATFORM" for v in result["violations"])
