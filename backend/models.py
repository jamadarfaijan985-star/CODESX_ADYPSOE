
from pydantic import BaseModel, Field, model_validator


class Train(BaseModel):
    id: str
    arrival: int = Field(ge=0)
    departure: int = Field(gt=0)
    platform_id: str
    mandatory_platform_id: str | None = None

    @model_validator(mode="after")
    def validate_times(self):
        if self.departure <= self.arrival:
            raise ValueError("Departure must be after arrival")
        return self


class Platform(BaseModel):
    id: str
    closed_intervals: list[tuple[int, int]] = Field(default_factory=list)
    availability_intervals: list[tuple[int, int]] = Field(default_factory=list)
    supported_train_ids: list[str] | None = None

    @model_validator(mode="after")
    def validate_constraints(self):
        for start, end in [
            *self.closed_intervals,
            *self.availability_intervals,
        ]:
            if start < 0 or end <= start:
                raise ValueError("Platform intervals must have a non-negative start before their end")

        if self.supported_train_ids is not None and (
            len(self.supported_train_ids) != len(set(self.supported_train_ids))
        ):
            raise ValueError("Supported train IDs must be unique")
        return self


class StationProfile(BaseModel):
    station_id: str = Field(min_length=1)
    display_name: str = Field(min_length=1)
    description: str = ""
    illustrative: bool = False
    minimum_gap_minutes: int = Field(default=5, ge=0)
    platforms: list[Platform]

    @model_validator(mode="after")
    def validate_platform_ids(self):
        platform_ids = [platform.id for platform in self.platforms]
        if len(platform_ids) != len(set(platform_ids)):
            raise ValueError("Platform IDs must be unique")
        return self


class StationTimetable(BaseModel):
    station_id: str = "ST01"
    station_name: str = "Central Junction"
    station_illustrative: bool = False
    minimum_gap_minutes: int = Field(default=5, ge=0)
    platforms: list[Platform]
    trains: list[Train]

    @model_validator(mode="after")
    def validate_unique_ids(self):
        platform_ids = [p.id for p in self.platforms]
        train_ids = [t.id for t in self.trains]

        if len(platform_ids) != len(set(platform_ids)):
            raise ValueError("Platform IDs must be unique")

        if len(train_ids) != len(set(train_ids)):
            raise ValueError("Train IDs must be unique")

        return self


class DelayRequest(BaseModel):
    train_id: str
    delay_minutes: int = Field(gt=0)


class ClosureRequest(BaseModel):
    platform_id: str
    start_minute: int = Field(ge=0)
    end_minute: int = Field(gt=0)

    @model_validator(mode="after")
    def validate_interval(self):
        if self.end_minute <= self.start_minute:
            raise ValueError("Closure end must be after closure start")
        return self


class DisruptionTextRequest(BaseModel):
    text: str = Field(min_length=3, max_length=500)
