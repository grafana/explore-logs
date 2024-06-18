---
description: Get set up and take a tour of Explore Logs.
keywords:
  - Logs
  - Explore
  - Labels
  - Analysis
menuTitle: Get started
title: Get started with Explore Logs
weight: 800
---

# Get started with Explore Logs

{{% admonition type="caution" %}}
Explore Metrics is currently in [public preview](/docs/release-life-cycle/). Grafana Labs offers limited support, and breaking changes might occur prior to the feature being made generally available.
{{% /admonition %}}

The best way to see what Explore Logs can do for you is to run it on your own data.

## Guide

This guide walks you through a simple step-by-step guide providing a quick tour of Explore Logs.

> Instructions for how to access or install Explore Logs are below.

While you are browsing around the app, look out for any unexpected spikes. Or perhaps one of your services is down and has stopped logging. Maybe you're seeing an increase in errors after a recent release.

To take a tour of Explore Logs, follow these steps:

1. In the main navigation bar click on **Explore > Logs**
2. You’ll land in the service overview page that shows time series and log visualizations for all the services in your selected Loki instance.
3. Change your data source with the drop-down on the top left.
4. Modify your time range in two ways:
   - With the standard time range picker on the top right.
   - By clicking and dragging the time range you want to see on any time series visualization.
5. Services are shown based on the volume of logs, and you can search for the service you want through the Search service input.
6. Click **Select** on the service you would like to explore.
7. Filter logs based on labels, detected fields, or patterns.

## Access in Grafana Cloud

Explore Logs is already available in Grafana Cloud.

To access Explore Logs:

1. Open your Grafana stack in a web browser
1. In the primary navigation on the left hand side of the screen, click **Explore > Logs**

### Install via environment variable

If you want to [install the app in a docker container](https://grafana.com/docs/grafana/latest/setup-grafana/configure-docker/#install-plugins-in-the-docker-container), you need to configure the following environment variable:

```
GF_INSTALL_PLUGINS=https://storage.googleapis.com/integration-artifacts/grafana-lokiexplore-app/grafana-lokiexplore-app-latest.zip;grafana-lokiexplore-app
```

## Install using grafana-cli

You can install Explore Logs in your own Grafana instance using `grafana-cli`:
> [!IMPORTANT]  
> The following Loki and Grafana version and configuration are required:
> - Loki v 3.0+
>   - `--pattern-ingester.enabled=true` for pattern ingestion
>   -  Volume endpoint enabled in Loki config:
> ```yaml
>limits_config:
>  volume_enabled: true
>```
> - Grafana v11.0+

```sh
grafana-cli --pluginUrl=https://storage.googleapis.com/integration-artifacts/grafana-lokiexplore-app/grafana-lokiexplore-app-latest.zip plugins install grafana-lokiexplore-app
```

### Test with Docker Compose

Test out the app using the following command to spin up Grafana, Loki, and the Logs Explore App:

```sh
curl -L https://github.com/grafana/explore-logs/raw/main/scripts/run.sh | sh
```

This will download the https://github.com/grafana/explore-logs/blob/main/scripts/run.sh file and execute it. That shell file will download some configuration files into your `/tmp/explore-logs` directory and start the docker containers via `docker compose` from there.

Once the docker container has started, navigate to http://localhost:3000/a/grafana-lokiexplore-app/explore to access Explore Logs.
