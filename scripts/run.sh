#!/bin/sh

mkdir -p /tmp/explore-logs/config
mkdir -p /tmp/explore-logs/provisioning/datasources
mkdir -p /tmp/explore-logs/provisioning/plugins

# Download files
curl https://raw.githubusercontent.com/grafana/explore-logs/main/config/loki-config.yaml -o /tmp/explore-logs/config/loki-config.yaml
curl https://raw.githubusercontent.com/grafana/explore-logs/main/provisioning/datasources/default.yaml -o /tmp/explore-logs/provisioning/datasources/default.yaml
curl https://raw.githubusercontent.com/grafana/explore-logs/main/provisioning/plugins/app.yaml -o /tmp/explore-logs/provisioning/plugins/app.yaml

curl https://raw.githubusercontent.com/grafana/explore-logs/main/docker-compose.yaml -o /tmp/explore-logs/docker-compose.yaml

docker compose -f /tmp/explore-logs/docker-compose.yaml up
