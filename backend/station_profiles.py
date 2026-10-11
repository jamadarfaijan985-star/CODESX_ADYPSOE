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


def initial_timetable_for_profile(profile: StationProfile) -> StationTimetable:
    """Return the backend-owned illustrative seed timetable for a profile."""
    seed_trains = {
        "ST01": [
            Train(id="T101", arrival=540, departure=555, platform_id="P1"),
            Train(id="T102", arrival=550, departure=565, platform_id="P1"),
            Train(
                id="T103",
                arrival=560,
                departure=575,
                platform_id="P2",
                mandatory_platform_id="P2",
            ),
            Train(id="T104", arrival=580, departure=595, platform_id="P1"),
            Train(id="T105", arrival=590, departure=605, platform_id="P2"),
        ],
        "ILLUSTRATIVE-NORTH": [
            Train(id="N201", arrival=490, departure=510, platform_id="N1"),
            Train(id="N202", arrival=525, departure=550, platform_id="N1"),
            Train(id="N203", arrival=500, departure=530, platform_id="N2"),
        ],
        "ILLUSTRATIVE-YARD": [
            Train(id="Y301", arrival=450, departure=525, platform_id="Y1"),
            Train(id="Y302", arrival=480, departure=555, platform_id="Y2"),
        ],
    }
    return timetable_for_profile(profile, seed_trains[profile.station_id])


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
