from datetime import date

import pytest
from pydantic import ValidationError

from backend.arrival_delay_prediction import (
    INPUT_FEATURES,
    MODEL_ID,
    MODEL_PATH,
    ArrivalDelayPredictionInput,
    load_arrival_delay_model,
    predict_arrival_delay,
)
from backend.main import app


def test_selected_model_loads_with_expected_pipeline_contract():
    assert MODEL_PATH.is_file()
    model = load_arrival_delay_model()

    assert tuple(model.feature_names_in_) == INPUT_FEATURES
    assert type(model.named_steps["model"]).__name__ == "HistGradientBoostingRegressor"
    assert tuple(model.named_steps["preprocess"].get_feature_names_out())


def test_valid_prediction_returns_experimental_nonnegative_float():
    request = ArrivalDelayPredictionInput(
        service_date=date(2026, 8, 31),
        seq=23,
        station_code="TVC",
    )

    response = predict_arrival_delay(request)

    assert isinstance(response.predicted_delay_minutes, float)
    assert response.predicted_delay_minutes >= 0
    assert response.model_id == MODEL_ID
    assert response.status == "experimental"
    assert response.experimental is True
    assert "not a confirmed delay" in response.disclaimer


def test_prediction_endpoint_is_registered_without_timetable_mutation():
    route = next(
        route for route in app.routes
        if getattr(route, "path", None) == "/api/predictions/arrival-delay"
    )

    assert "POST" in route.methods


@pytest.mark.parametrize(
    "payload",
    [
        {"service_date": "2026-08-31", "station_code": "TVC"},
        {"service_date": "2026-08-31", "seq": 23},
        {"seq": 23, "station_code": "TVC"},
    ],
)
def test_missing_required_inputs_are_rejected(payload):
    with pytest.raises(ValidationError):
        ArrivalDelayPredictionInput.model_validate(payload)


@pytest.mark.parametrize(
    "payload",
    [
        {"service_date": "2026-08-31", "seq": -1, "station_code": "TVC"},
        {"service_date": "not-a-date", "seq": 23, "station_code": "TVC"},
        {"service_date": "2026-08-31", "seq": 23.5, "station_code": "TVC"},
        {"service_date": "2026-08-31", "seq": 23, "station_code": "tvc"},
        {"service_date": "2026-08-31", "seq": 23, "station_code": ""},
    ],
)
def test_invalid_inputs_are_rejected(payload):
    with pytest.raises(ValidationError):
        ArrivalDelayPredictionInput.model_validate(payload)
