use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThreatEvent {
    pub id: String,
    pub timestamp: String,
    pub severity: String,
    pub event_type: String,
    pub source: String,
    #[serde(default)]
    pub source_host: Option<String>,
    #[serde(default)]
    pub source_role: Option<String>,
    #[serde(default)]
    pub guardian_id: Option<String>,
    #[serde(default)]
    pub guardian_tags: Vec<String>,
    pub description: String,
    pub affected: Vec<String>,
    #[serde(default)]
    pub metadata: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionRequest {
    pub id: String,
    pub event_id: String,
    pub action: String,
    pub target: String,
    pub reason: String,
    pub created_at: String,
    #[serde(default)]
    pub guardian_id: Option<String>,
    #[serde(default)]
    pub guardian_tags: Vec<String>,
    #[serde(default)]
    pub requested_by: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionUpdate {
    pub id: String,
    pub action: String,
    pub status: String,
    #[serde(default)]
    pub guardian_id: Option<String>,
    #[serde(default)]
    pub guardian_tags: Vec<String>,
    #[serde(default)]
    pub created_at: String,
    #[serde(default)]
    pub executed_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Receipt {
    pub id: String,
    pub action_id: String,
    pub timestamp: String,
    pub hash: String,
    pub proof: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CapabilityValidation {
    pub token: String,
    pub allowed_actions: Vec<String>,
    pub valid: bool,
}

#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub error: String,
    pub details: Option<String>,
}
