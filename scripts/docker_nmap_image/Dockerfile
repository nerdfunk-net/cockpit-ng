# Dockerfile — Cockpit Nmap Agent (air-gap ready)
# Multi-stage: apt packages + Python wheels are baked in during build;
# the final image needs no network access at runtime.

# Build-time proxy args (forwarded from the build script)
ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG NO_PROXY

# ---------------------------------------------------------------------------
# Stage 1: base — system packages (nmap)
# ---------------------------------------------------------------------------
FROM python:3.12-slim AS base

ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG NO_PROXY

RUN if [ -n "$HTTP_PROXY" ] || [ -n "$HTTPS_PROXY" ]; then \
      echo "Acquire::http::Proxy \"${HTTP_PROXY}\";" > /etc/apt/apt.conf.d/01proxy; \
      echo "Acquire::https::Proxy \"${HTTPS_PROXY}\";" >> /etc/apt/apt.conf.d/01proxy; \
    fi \
    && apt-get update && apt-get install -y --no-install-recommends \
       nmap \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean \
    && rm -f /etc/apt/apt.conf.d/01proxy || true

# ---------------------------------------------------------------------------
# Stage 2: python-builder — pre-download all wheels into a wheelhouse
# ---------------------------------------------------------------------------
FROM base AS python-builder

ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG NO_PROXY

COPY scripts/cockpit_agent_nmap/requirements.txt /tmp/requirements.txt
RUN pip install --upgrade pip wheel \
    && pip wheel -r /tmp/requirements.txt -w /tmp/wheelhouse

# ---------------------------------------------------------------------------
# Stage 3: runtime — install from local wheelhouse, no network needed
# ---------------------------------------------------------------------------
FROM base AS runtime

ENV PYTHONUNBUFFERED=1
ENV NMAP_PATH=/usr/bin/nmap

WORKDIR /app

# Install Python deps from pre-built wheels (air-gap safe: --no-index)
COPY --from=python-builder /tmp/wheelhouse /tmp/wheelhouse
COPY scripts/cockpit_agent_nmap/requirements.txt .
RUN pip install --no-index --find-links /tmp/wheelhouse -r requirements.txt \
    && rm -rf /tmp/wheelhouse

# Copy agent source files
COPY scripts/cockpit_agent_nmap/agent.py .
COPY scripts/cockpit_agent_nmap/config.py .
COPY scripts/cockpit_agent_nmap/executor.py .
COPY scripts/cockpit_agent_nmap/heartbeat.py .

LABEL org.opencontainers.image.title="Cockpit Nmap Agent"
LABEL org.opencontainers.image.description="Air-gap ready Cockpit agent with nmap for remote port scanning"
LABEL org.opencontainers.image.version="1.0"
LABEL org.opencontainers.image.vendor="nerdfunk-net"

CMD ["python", "agent.py"]
