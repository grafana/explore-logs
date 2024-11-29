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

RUN go mod download
RUN CGO_ENABLED=0 GOOS=linux go build -o /generator

# Copy the OTEL collector config
COPY otel-config.yaml /etc/otel/config.yaml

# Create a startup script
COPY <<EOF /start.sh
#!/bin/sh
# Start the OTEL collector in the background
/otelcol-contrib --config /etc/otel/config.yaml &

# Wait a bit for collector to start
sleep 2

# Start the log generator with the collector endpoint
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317 /generator
EOF

RUN chmod +x /start.sh

ENTRYPOINT ["/start.sh"]
