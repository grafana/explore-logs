# Start with the OTEL collector stage
FROM otel/opentelemetry-collector-contrib:latest AS collector

# Final stage
FROM golang:1.22

# Copy the collector binary from the collector stage
COPY --from=collector /otelcol-contrib /otelcol-contrib

WORKDIR /go/src/app

# Copy and build the log generator
COPY go.mod go.sum ./
COPY *.go ./
COPY flog/ flog/
COPY log/ log/

RUN go mod download
RUN CGO_ENABLED=0 GOOS=linux go build -o /generator

# Copy the OTEL collector config
COPY otel-config.yaml /etc/otel/config.template.yaml

COPY <<EOF /start.sh
#!/bin/sh
# Set default OTLP endpoint if not provided
OTLP_ENDPOINT=\${OTLP_ENDPOINT:-http://host.docker.internal:3100/otlp}

# Replace environment variables in the config template
envsubst < /etc/otel/config.template.yaml > /etc/otel/config.yaml

# Start the OTEL collector in the background
/otelcol-contrib --config /etc/otel/config.yaml &

# Wait a bit for collector to start
sleep 2

# Start the log generator
/generator \$@
EOF

# Install envsubst utility
RUN apt-get update && apt-get install -y gettext-base && rm -rf /var/lib/apt/lists/*

RUN chmod +x /start.sh

ENTRYPOINT ["/start.sh"]
