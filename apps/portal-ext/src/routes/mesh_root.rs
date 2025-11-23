use std::fs;
use std::path::PathBuf;

use axum::{extract::State, http::StatusCode, Json};
use serde::Deserialize;
use serde_json::Value;

use crate::mesh::envelope::MeshEnvelope;
use crate::mesh::util::{find_peer, verify_signature};
use crate::models::ErrorResponse;
use crate::AppState;

#[derive(Debug, Deserialize)]
struct RootAnnouncement {
    root: String,
    ts: String,
    anchor: Option<Value>,
}

fn is_hex(s: &str) -> bool {
    !s.is_empty() && s.chars().all(|c| c.is_ascii_hexdigit())
}

pub async fn mesh_root(
    State(state): State<AppState>,
    Json(env): Json<MeshEnvelope>,
) -> Result<Json<Value>, (StatusCode, Json<ErrorResponse>)> {
    let peer = find_peer(&state.config, &env.node_id).ok_or_else(|| {
        (
            StatusCode::FORBIDDEN,
            Json(ErrorResponse {
                error: "unknown mesh peer".to_string(),
                details: Some(env.node_id.clone()),
            }),
        )
    })?;

    if env.kind != "root_announce" {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "invalid mesh kind (expected root_announce)".to_string(),
                details: Some(env.kind),
            }),
        ));
    }

    if let Err(e) = verify_signature(&peer.pubkey, &env.sig, &env.payload) {
        return Err((
            StatusCode::FORBIDDEN,
            Json(ErrorResponse {
                error: "mesh signature verification failed".to_string(),
                details: Some(e.to_string()),
            }),
        ));
    }

    let ann: RootAnnouncement = serde_json::from_value(env.payload.clone()).map_err(|e| {
        (
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "invalid root_announce payload".to_string(),
                details: Some(e.to_string()),
            }),
        )
    })?;

    if !is_hex(&ann.root) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "root is not valid hex".to_string(),
                details: Some(ann.root),
            }),
        ));
    }

    if let Some(anchor) = &ann.anchor {
        if let Some(a_root) = anchor.get("root").and_then(|v| v.as_str()) {
            if a_root != ann.root {
                return Err((
                    StatusCode::BAD_REQUEST,
                    Json(ErrorResponse {
                        error: "anchor.root does not match root".to_string(),
                        details: Some(a_root.to_string()),
                    }),
                ));
            }
        }
    }

    let data_dir = &state.config.data_dir;
    let node_id = &peer.id;
    let dir = PathBuf::from(data_dir).join("mesh/roots").join(node_id);
    if let Err(e) = fs::create_dir_all(&dir) {
        return Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "failed to create mesh roots dir".to_string(),
                details: Some(e.to_string()),
            }),
        ));
    }

    let payload_bytes = serde_json::to_vec_pretty(&env.payload).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "failed to serialize mesh root announcement".to_string(),
                details: Some(e.to_string()),
            }),
        )
    })?;

    let safe_ts = ann.ts.replace(':', "_");
    let path = dir.join(format!("{safe_ts}.json"));
    if let Err(e) = fs::write(&path, payload_bytes) {
        return Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "failed to write mesh root announcement".to_string(),
                details: Some(e.to_string()),
            }),
        ));
    }

    let ws_payload = serde_json::json!({
        "type": "mesh.root_announce",
        "data": {
            "from": node_id,
            "root": ann.root,
            "ts": ann.ts,
            "anchor": ann.anchor
        }
    });

    state.ws.send_json(&ws_payload);

    Ok(Json(serde_json::json!({ "status": "accepted" })))
}
