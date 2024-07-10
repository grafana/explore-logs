---
description: Access and installation guide for Explore Logs.
keywords:
  - Logs
  - Explore
  - Labels
  - Analysis
menuTitle: Access or Install
title: Access or install Explore Logs
weight: 200
---

{{< admonition type="caution" >}}  
Explore Logs is currently in [public preview](/docs/release-life-cycle/). Grafana Labs offers limited support, and breaking changes might occur prior to the feature being made generally available.
{{< /admonition >}}

# Access Explore Logs

To use Explore Logs on your own data, you can either access it in Grafana Cloud or install it in your own Grafana instance.

{{< docs/play title="the Grafana Play site" url="https://play.grafana.org/a/grafana-lokiexplore-app/explore?var-ds=ddhr3fttaw8aod&var-patterns=&var-lineFilter=&var-logsFormat=" >}}

## Access in Grafana Cloud

Explore Logs is already available in Grafana Cloud.

To access Explore Logs:

1. Open your Grafana stack in a web browser
1. In the main menu, select **Explore** > **Logs**.

## Installation

The following Loki and Grafana version and configuration are required:

- Loki v3.0+
  - `--pattern-ingester.enabled=true` for pattern ingestion
  -  Volume endpoint enabled in Loki config:
```yaml
limits_config:
  volume_enabled: true
```
- Grafana v11.0+

### Install via environment variable

If you want to [install the app in a docker container](https://grafana.com/docs/grafana/latest/setup-grafana/configure-docker/#install-plugins-in-the-docker-container), you need to configure the following environment variable:

```
GF_INSTALL_PLUGINS=https://storage.googleapis.com/integration-artifacts/grafana-lokiexplore-app/grafana-lokiexplore-app-latest.zip;grafana-lokiexplore-app
```

## Install using grafana-cli

You can install Explore Logs in your own Grafana instance using `grafana-cli`.

Using `grafana-cli` run the following command:
```sh
grafana-cli --pluginUrl=https://storage.googleapis.com/integration-artifacts/grafana-lokiexplore-app/grafana-lokiexplore-app-latest.zip plugins install grafana-lokiexplore-app
```

### Test with Docker Compose

You can test the app using the following command to spin up Grafana, Loki, and the Explore Logs App:  
```sh
curl -L https://github.com/grafana/explore-logs/raw/main/scripts/run.sh | sh
```

This will download the https://github.com/grafana/explore-logs/blob/main/scripts/run.sh file and execute it. 

That shell file will download some configuration files into your `/tmp/explore-logs` directory and start the docker containers via `docker compose` from there.

Once the docker container has started, navigate to `http://localhost:3000/a/grafana-lokiexplore-app/explore` to access Explore Logs.

# Having trouble?

Check out our [troubleshooting guides]({{< relref "../troubleshooting" >}}) for tips on how to solve common issues.
