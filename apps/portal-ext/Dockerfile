# NOTE: Using nightly due to edition-2024 deps (e.g., base64ct/home). TODO: revert to a pinned stable toolchain when upstream stabilizes.
FROM rustlang/rust:nightly AS builder
WORKDIR /app

COPY Cargo.toml Cargo.lock ./
COPY src ./src
RUN cargo build --release

FROM debian:bookworm-slim
WORKDIR /app

RUN useradd -m offsec && mkdir -p /app/data && chown -R offsec:offsec /app
COPY --from=builder /app/target/release/portal-ext /usr/local/bin/portal-ext

ENV RUST_LOG=info
EXPOSE 9115
USER offsec

CMD ["portal-ext"]
