
from backend.models import Platform, StationTimetable, Train
from backend.scheduler import schedule_timetable


def test_scheduler_finds_valid_assignments():
    timetable = StationTimetable(
        minimum_gap_minutes=5,
        platforms=[Platform(id="P1"), Platform(id="P2")],
        trains=[
            Train(id="T1", arrival=540, departure=560, platform_id="P1"),
            Train(id="T2", arrival=550, departure=570, platform_id="P1"),
        ],
    )

    result = schedule_timetable(timetable)

    assert result["status"] == "VALID_FOUND"
    assert result["validation"]["valid"] is True

    assigned = {
        train["id"]: train["platform_id"]
        for train in result["schedule"]["trains"]
    }
    assert assigned["T1"] != assigned["T2"]


def test_scheduler_respects_mandatory_platform():
    timetable = StationTimetable(
        minimum_gap_minutes=5,
        platforms=[Platform(id="P1"), Platform(id="P2")],
        trains=[
            Train(
                id="T1",
                arrival=540,
                departure=550,
                platform_id="P2",
                mandatory_platform_id="P1",
            ),
        ],
    )

    result = schedule_timetable(timetable)

    assert result["status"] == "VALID_FOUND"
    assert result["schedule"]["trains"][0]["platform_id"] == "P1"


def test_scheduler_rejects_impossible_assignment():
    timetable = StationTimetable(
        minimum_gap_minutes=5,
        platforms=[
            Platform(id="P1", closed_intervals=[(540, 600)]),
        ],
        trains=[
            Train(id="T1", arrival=550, departure=560, platform_id="P1"),
        ],
    )

    result = schedule_timetable(timetable)

    assert result["status"] == "INFEASIBLE_UNDER_MODEL"
    assert result["schedule"] is None


def test_scheduler_respects_platform_train_compatibility():
    timetable = StationTimetable(
        platforms=[
            Platform(id="P1", supported_train_ids=["T1"]),
            Platform(id="P2", supported_train_ids=["T2"]),
        ],
        trains=[Train(id="T1", arrival=540, departure=550, platform_id="P2")],
    )

    result = schedule_timetable(timetable)

    assert result["status"] == "VALID_FOUND"
    assert result["schedule"]["trains"][0]["platform_id"] == "P1"
