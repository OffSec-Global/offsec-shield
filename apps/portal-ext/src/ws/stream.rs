use axum::{
    extract::ws::{Message, WebSocketUpgrade},
    extract::State,
    response::IntoResponse,
};
use tokio::sync::broadcast;

use crate::AppState;

#[derive(Clone)]
pub struct WsBroadcaster {
    tx: broadcast::Sender<String>,
}

impl WsBroadcaster {
    pub fn new() -> Self {
        let (tx, _rx) = broadcast::channel(256);
        Self { tx }
    }

    pub fn send_json(&self, payload: &serde_json::Value) {
        let _ = self.tx.send(payload.to_string());
    }

    pub fn subscribe(&self) -> broadcast::Receiver<String> {
        self.tx.subscribe()
    }
}

pub async fn handler(State(state): State<AppState>, ws: WebSocketUpgrade) -> impl IntoResponse {
    let mut rx = state.ws.subscribe();

    ws.on_upgrade(move |mut socket| async move {
        while let Ok(msg) = rx.recv().await {
            if socket.send(Message::Text(msg)).await.is_err() {
                break;
            }
        }
    })
}
