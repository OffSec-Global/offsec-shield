FROM python:3.11-slim
WORKDIR /app

ENV POETRY_VIRTUALENVS_CREATE=false \
    POETRY_NO_INTERACTION=1

RUN pip install --no-cache-dir poetry
COPY pyproject.toml ./
RUN poetry install --no-root

COPY guardian ./guardian

CMD ["poetry", "run", "guardian", "run"]
