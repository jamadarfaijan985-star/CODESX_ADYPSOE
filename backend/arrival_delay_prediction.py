"""Safe inference wrapper for the experimental arrival-delay model."""

from datetime import date
from functools import lru_cache
from pathlib import Path
from typing import Any

import joblib
import pandas as pd
from pydantic import BaseModel, Field, StrictInt, StrictStr


MODEL_PATH = (
    Path(__file__).resolve().parents[1]
    / "ml"
    / "experiments"
    / "delay_model_comparison"
    / "selected_model.joblib"
)
MODEL_ID = "arrival-delay-hist-gradient-boosting-experiment-v1"
MODEL_STATUS = "experimental"
DISCLAIMER = (
    "Experimental historical estimate, not a confirmed delay or operational "
    "guarantee. Trained only on train 12624 data and not validated for all "
    "Indian Railways services or stations."
)
INPUT_FEATURES = ("seq", "station_code", "day_of_week", "month")


class ArrivalDelayPredictionInput(BaseModel):
    """Fields available before arrival and required by the trained pipeline."""

    service_date: date
    seq: StrictInt = Field(ge=0)
    station_code: StrictStr = Field(
        min_length=1,
        pattern=r"^[A-Z0-9]+$",
    )


class ArrivalDelayPredictionResponse(BaseModel):
    predicted_delay_minutes: float = Field(ge=0)
    model_id: str
    status: str
    experimental: bool = True
    disclaimer: str


class ArrivalDelayModelError(RuntimeError):
    """Raised when the saved model cannot be safely used for inference."""


def _validate_pipeline(model: Any) -> Any:
    if not hasattr(model, "predict") or not hasattr(model, "named_steps"):
        raise ArrivalDelayModelError("Selected artifact is not a fitted sklearn pipeline.")

    if tuple(getattr(model, "feature_names_in_", ())) != INPUT_FEATURES:
        raise ArrivalDelayModelError(
            "Selected model input features do not match the experiment contract."
        )

    preprocess = model.named_steps.get("preprocess")
    estimator = model.named_steps.get("model")
    if preprocess is None or estimator is None:
        raise ArrivalDelayModelError("Selected pipeline is missing preprocessing or model steps.")

    transformed_features = tuple(preprocess.get_feature_names_out())
    if not transformed_features:
        raise ArrivalDelayModelError("Selected pipeline exposes no transformed features.")
    if type(estimator).__name__ != "HistGradientBoostingRegressor":
        raise ArrivalDelayModelError(
            "Selected artifact is not the expected HistGradientBoosting model."
        )
    return model


@lru_cache(maxsize=1)
def load_arrival_delay_model() -> Any:
    if not MODEL_PATH.is_file():
        raise ArrivalDelayModelError(
            f"Arrival-delay model artifact was not found at {MODEL_PATH}."
        )
    try:
        model = joblib.load(MODEL_PATH)
    except Exception as exc:
        raise ArrivalDelayModelError("Arrival-delay model artifact could not be loaded.") from exc
    return _validate_pipeline(model)


def _feature_row(request: ArrivalDelayPredictionInput) -> pd.DataFrame:
    return pd.DataFrame([{
        "seq": request.seq,
        "station_code": request.station_code,
        "day_of_week": request.service_date.weekday(),
        "month": request.service_date.month,
    }], columns=INPUT_FEATURES)


def predict_arrival_delay(
    request: ArrivalDelayPredictionInput,
) -> ArrivalDelayPredictionResponse:
    model = load_arrival_delay_model()
    prediction = float(model.predict(_feature_row(request))[0])
    if prediction != prediction or prediction in (float("inf"), float("-inf")):
        raise ArrivalDelayModelError("Arrival-delay model returned a non-finite prediction.")
    if prediction < 0:
        raise ArrivalDelayModelError("Arrival-delay model returned a negative prediction.")

    return ArrivalDelayPredictionResponse(
        predicted_delay_minutes=prediction,
        model_id=MODEL_ID,
        status=MODEL_STATUS,
        disclaimer=DISCLAIMER,
    )
