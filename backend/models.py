
from pydantic import BaseModel, Field


class Train(BaseModel):
    id: str
    arrival: int = Field(ge=0, description="Arrival time in minutes")
    departure: int = Field(gt=0, description="Departure time in minutes")
    platform_id: str
    mandatory_platform_id: str | None = None

    def model_post_init(self, __context) -> None:
        if self.departure <= self.arrival:
            raise ValueError("Departure must be after arrival")


class Platform(BaseModel):
    id: str
    closed_intervals: list[tuple[int, int]] = Field(default_factory=list)


class StationTimetable(BaseModel):
    minimum_gap_minutes: int = Field(default=5, ge=0)
    platforms: list[Platform]
    trains: list[Train]
