FROM rust:1.73 AS builder
WORKDIR /app

COPY Cargo.toml ./
COPY src ./src
RUN cargo build --release

FROM debian:bookworm-slim
WORKDIR /app

RUN useradd -m offsec
COPY --from=builder /app/target/release/portal-ext /usr/local/bin/portal-ext

ENV RUST_LOG=info
EXPOSE 9115
USER offsec

CMD ["portal-ext"]
