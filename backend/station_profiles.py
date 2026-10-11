from backend.models import Platform, StationProfile, StationTimetable, Train


def _demo_profile() -> StationProfile:
    return StationProfile(
        station_id="ST01",
        display_name="Central Junction",
        description="Fictional RailFlow demonstration station.",
        minimum_gap_minutes=5,
        platforms=[
            Platform(id="P1", supported_train_ids=["T101", "T102", "T103", "T104", "T105"]),
            Platform(id="P2", supported_train_ids=["T101", "T102", "T103", "T104", "T105"]),
            Platform(id="P3", supported_train_ids=["T101", "T102", "T103", "T104", "T105"]),
        ],
    )


def _illustrative_north_profile() -> StationProfile:
    return StationProfile(
        station_id="ILLUSTRATIVE-NORTH",
        display_name="Illustrative North Terminal",
        description="Illustrative profile for demos; not a reproduction of Indian railway infrastructure.",
        illustrative=True,
        minimum_gap_minutes=6,
        platforms=[Platform(id="N1"), Platform(id="N2")],
    )


def _illustrative_yard_profile() -> StationProfile:
    return StationProfile(
        station_id="ILLUSTRATIVE-YARD",
        display_name="Illustrative Yard Station",
        description="Illustrative profile for demos; not a reproduction of Indian railway infrastructure.",
        illustrative=True,
        minimum_gap_minutes=3,
        platforms=[
            Platform(id="Y1"),
            Platform(id="Y2"),
            Platform(id="Y3"),
        ],
    )


STATION_PROFILES: dict[str, StationProfile] = {
    profile.station_id: profile
    for profile in (
        _demo_profile(),
        _illustrative_north_profile(),
        _illustrative_yard_profile(),
    )
}


def list_station_profiles() -> list[StationProfile]:
    return list(STATION_PROFILES.values())


def get_station_profile(station_id: str) -> StationProfile | None:
    return STATION_PROFILES.get(station_id)


def timetable_for_profile(
    profile: StationProfile,
    trains: list[Train],
) -> StationTimetable:
    return StationTimetable(
        station_id=profile.station_id,
        station_name=profile.display_name,
        station_illustrative=profile.illustrative,
        minimum_gap_minutes=profile.minimum_gap_minutes,
        platforms=[platform.model_copy(deep=True) for platform in profile.platforms],
        trains=[train.model_copy(deep=True) for train in trains],
    )
