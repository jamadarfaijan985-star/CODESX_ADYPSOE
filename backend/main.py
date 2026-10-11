
from fastapi import FastAPI

app = FastAPI(
    title="RailFlow API",
    description="Constraint-based railway platform scheduling and disruption management.",
    version="0.1.0",
)


@app.get("/")
def root():
    return {
        "message": "RailFlow API is running!",
        "status": "success",
    }


@app.get("/api/health")
def health():
    return {
        "status": "healthy",
        "service": "RailFlow backend",
    }
