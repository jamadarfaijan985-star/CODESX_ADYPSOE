import json
import threading
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import pytest
import uvicorn

from backend import main as main_module
from backend.main import create_demo_timetable
from backend.validator import validate_timetable


@pytest.fixture(scope="session")
def http_server():
    config = uvicorn.Config(
        main_module.app,
        host="127.0.0.1",
        port=0,
        log_level="error",
        lifespan="off",
    )
    server = uvicorn.Server(config)
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()

    deadline = time.monotonic() + 10
    while not server.started and time.monotonic() < deadline:
        time.sleep(0.05)

    if not server.started or not server.servers:
        server.should_exit = True
        thread.join(timeout=5)
        raise RuntimeError("Uvicorn test server did not start")

    port = server.servers[0].sockets[0].getsockname()[1]
    try:
        yield f"http://127.0.0.1:{port}"
    finally:
        server.should_exit = True
        thread.join(timeout=5)


@pytest.fixture(autouse=True)
def reset_backend_state():
    main_module.current_timetable = create_demo_timetable()
    main_module.schedule_history = []


def http_json(base_url, path, method="GET", payload=None):
    body = None
    headers = {}
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"

    request = Request(
        f"{base_url}{path}",
        data=body,
        headers=headers,
        method=method,
    )
    try:
        with urlopen(request, timeout=10) as response:
            return response.status, json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        return error.code, json.loads(error.read().decode("utf-8"))


def demo_timetable_payload():
    return create_demo_timetable().model_dump(mode="json")


def test_health_route_returns_json_success(http_server):
    status, body = http_json(http_server, "/api/health")

    assert status == 200
    assert body == {"status": "healthy", "service": "RailFlow backend"}


def test_timetable_and_conflicts_routes_return_demo_state(http_server):
    timetable_status, timetable = http_json(http_server, "/api/timetable")
    conflict_status, conflicts = http_json(http_server, "/api/conflicts")

    assert timetable_status == 200
    assert timetable["station"]["id"] == "ST01"
    assert {platform["id"] for platform in timetable["platforms"]} == {"P1", "P2", "P3"}
    assert conflict_status == 200
    assert conflicts["count"] == 1
    assert conflicts["conflicts"][0]["type"] == "OVERLAP"
    assert conflicts["conflicts"][0]["train_ids"] == ["T101", "T102"]


def test_prediction_route_returns_serialized_experimental_response(http_server):
    status, body = http_json(
        http_server,
        "/api/predictions/arrival-delay",
        method="POST",
        payload={"service_date": "2026-08-15", "seq": 10, "station_code": "TVC"},
    )

    assert status == 200
    assert isinstance(body["predicted_delay_minutes"], float)
    assert body["predicted_delay_minutes"] >= 0
    assert body["model_id"] == "arrival-delay-hist-gradient-boosting-experiment-v1"
    assert body["status"] == "experimental"
    assert body["experimental"] is True
    assert "not a confirmed delay" in body["disclaimer"]


@pytest.mark.parametrize(
    "payload",
    [
        {"service_date": "2026-08-15", "station_code": "TVC"},
        {"service_date": "2026-08-15", "seq": -1, "station_code": "TVC"},
        {"service_date": "2026-08-15", "seq": 10, "station_code": "tvc"},
    ],
)
def test_prediction_route_returns_422_for_invalid_payload(http_server, payload):
    status, body = http_json(
        http_server,
        "/api/predictions/arrival-delay",
        method="POST",
        payload=payload,
    )

    assert status == 422
    assert body["detail"]


def test_prediction_route_does_not_mutate_timetable_or_history(http_server):
    before_status, before_timetable = http_json(http_server, "/api/timetable")
    before_history_status, before_history = http_json(http_server, "/api/schedule/history")
    assert before_status == before_history_status == 200

    prediction_status, prediction = http_json(
        http_server,
        "/api/predictions/arrival-delay",
        method="POST",
        payload={"service_date": "2026-08-15", "seq": 10, "station_code": "TVC"},
    )

    after_status, after_timetable = http_json(http_server, "/api/timetable")
    after_history_status, after_history = http_json(http_server, "/api/schedule/history")

    assert prediction_status == 200
    assert prediction["experimental"] is True
    assert after_status == 200
    assert after_timetable == before_timetable
    assert after_history_status == 200
    assert after_history == before_history == {"runs": [], "count": 0}


def test_delay_route_replans_and_serializes_independently_valid_schedule(http_server):
    status, body = http_json(
        http_server,
        "/api/disruptions/delay",
        method="POST",
        payload={"train_id": "T102", "delay_minutes": 15},
    )

    assert status == 200
    assert body["status"] == "VALID_FOUND"
    assert body["validation"]["valid"] is True
    revised = create_demo_timetable().model_validate(body["schedule"])
    assert validate_timetable(revised)["valid"] is True
    delayed = next(train for train in revised.trains if train.id == "T102")
    assert (delayed.arrival, delayed.departure) == (565, 580)


def test_infeasible_replan_returns_its_status_without_overwriting_active_timetable(http_server):
    valid_status, valid_body = http_json(
        http_server,
        "/api/schedule/replan",
        method="POST",
        payload=demo_timetable_payload(),
    )
    assert valid_status == 200
    assert valid_body["status"] == "VALID_FOUND"
    before_status, before = http_json(http_server, "/api/timetable")

    status, body = http_json(
        http_server,
        "/api/schedule/replan?station_id=ILLUSTRATIVE-NORTH",
        method="POST",
        payload=demo_timetable_payload(),
    )
    after_status, after = http_json(http_server, "/api/timetable")

    assert status == 200
    assert body["status"] == "INFEASIBLE_UNDER_MODEL"
    assert body["schedule"] is None
    assert before_status == after_status == 200
    assert after == before


def test_profile_switch_and_incompatible_platform_are_enforced_over_http(http_server):
    candidate = {
        "station_id": "ST01",
        "station_name": "Central Junction",
        "minimum_gap_minutes": 5,
        "platforms": [
            {"id": "P1"},
            {"id": "P2"},
            {"id": "P3"},
        ],
        "trains": [
            {"id": "T1", "arrival": 540, "departure": 550, "platform_id": "P1"},
            {"id": "T2", "arrival": 550, "departure": 560, "platform_id": "P1"},
        ],
    }
    switch_status, switch_body = http_json(
        http_server,
        "/api/schedule/replan?station_id=ILLUSTRATIVE-NORTH",
        method="POST",
        payload=candidate,
    )
    active_status, active = http_json(http_server, "/api/timetable")
    closure_status, closure_body = http_json(
        http_server,
        "/api/disruptions/closure",
        method="POST",
        payload={"platform_id": "P1", "start_minute": 540, "end_minute": 570},
    )

    assert switch_status == 200
    assert switch_body["status"] == "VALID_FOUND"
    assert switch_body["validation"]["valid"] is True
    assert active_status == 200
    assert active["station"]["id"] == "ILLUSTRATIVE-NORTH"
    assert {platform["id"] for platform in active["platforms"]} == {"N1", "N2"}
    assert closure_status == 404
    assert "P1" in closure_body["detail"]


def test_unknown_station_profile_returns_404_over_http(http_server):
    status, body = http_json(http_server, "/api/stations/profiles/UNKNOWN")

    assert status == 404
    assert "UNKNOWN" in body["detail"]


def test_station_selection_route_uses_backend_profile_over_http(http_server):
    status, body = http_json(
        http_server,
        "/api/stations/select",
        method="POST",
        payload={"station_id": "ILLUSTRATIVE-NORTH"},
    )
    active_status, active = http_json(http_server, "/api/timetable")

    assert status == 200
    assert body["status"] == "VALID_FOUND"
    assert body["validation"]["valid"] is True
    assert body["schedule"]["station_id"] == "ILLUSTRATIVE-NORTH"
    assert active_status == 200
    assert active["station"]["id"] == "ILLUSTRATIVE-NORTH"
    assert {platform["id"] for platform in active["platforms"]} == {"N1", "N2"}


def test_reopen_route_requires_end_time_and_returns_valid_schedule_over_http(http_server):
    closure_status, closure = http_json(
        http_server,
        "/api/disruptions/closure",
        method="POST",
        payload={"platform_id": "P1", "start_minute": 540, "end_minute": 570},
    )
    early_status, early = http_json(
        http_server,
        "/api/platforms/reopen",
        method="POST",
        payload={"platform_id": "P1", "reopen_minute": 569},
    )
    reopen_status, reopened = http_json(
        http_server,
        "/api/platforms/reopen",
        method="POST",
        payload={"platform_id": "P1", "reopen_minute": 570},
    )
    active_status, active = http_json(http_server, "/api/timetable")

    assert closure_status == 200
    assert closure["validation"]["valid"] is True
    assert early_status == 409
    assert "ends at minute 570" in early["detail"]
    assert reopen_status == 200
    assert reopened["status"] == "VALID_FOUND"
    assert reopened["validation"]["valid"] is True
    assert active_status == 200
    assert active["platforms"][0]["closed_intervals"] == []
