from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import datetime


class ThreatEvent(BaseModel):
    id: str
    timestamp: str
    severity: Literal["critical", "high", "medium", "low"]
    event_type: str
    source: str
    description: str
    affected: List[str] = Field(default_factory=list)
    metadata: dict = Field(default_factory=dict)


class ActionRequest(BaseModel):
    id: str
    event_id: str
    action: Literal["block_ip", "alert_human", "quarantine", "isolate_host"]
    target: str
    reason: str
    created_at: str


class Receipt(BaseModel):
    id: str
    action_id: str
    timestamp: str
    hash: str
    proof: str


class GuardianConfig(BaseModel):
    listen_port: int = 8001
    api_url: str = "http://localhost:9115"
    capability_token: str
    detectors_enabled: List[str] = Field(default_factory=list)
    log_level: str = "info"
