# OffSec Shield - Akash Runner Image
# Lightweight container for decentralized mesh nodes
#
# Build: docker build -t ghcr.io/vaultmesh/offsec-shield:latest -f ops/akash/Dockerfile .
# Push:  docker push ghcr.io/vaultmesh/offsec-shield:latest

FROM rust:1.75-slim-bookworm AS builder

WORKDIR /build

# Install build dependencies
RUN apt-get update && apt-get install -y \
    pkg-config libssl-dev git \
    && rm -rf /var/lib/apt/lists/*

# Copy engine (ledger-core dependency)
COPY --from=engine /home/sovereign/engine /engine

# Copy offsec-shield source
COPY apps/portal-ext /build/apps/portal-ext
COPY Cargo.toml Cargo.lock /build/

# Build portal-ext
WORKDIR /build/apps/portal-ext
RUN cargo build --release

# === Runtime Stage ===
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    ca-certificates libssl3 python3 python3-pip \
    && rm -rf /var/lib/apt/lists/* \
    && pip3 install --break-system-packages pynacl httpx

WORKDIR /app

# Copy binaries
COPY --from=builder /build/apps/portal-ext/target/release/portal-ext /app/portal-ext

# Copy mesh-daemon
COPY apps/mesh-daemon /app/mesh-daemon

# Copy startup script
COPY ops/akash/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Data directory
VOLUME /data

# Ports
EXPOSE 9115

# Environment defaults
ENV OFFSEC_LISTEN=0.0.0.0:9115 \
    OFFSEC_DATA_DIR=/data \
    OFFSEC_MESH_INTERVAL_SECONDS=60

ENTRYPOINT ["/app/entrypoint.sh"]
