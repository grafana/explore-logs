---
canonical: https://grafana.com/docs/grafana/latest/explore/simplified-exploration/logs/access/
description: Describes how to access Logs Drilldown in Grafana Cloud and the different installation methods for self-hosted Grafana.
keywords:
  - Logs
  - Explore
  - Labels
  - Analysis
menuTitle: Access or Install
title: Access or install Logs Drilldown
weight: 200
---

# Access or install Logs Drilldown

To use Logs Drilldown on your own data, you can either access it in Grafana Cloud or install it in your own Grafana instance.

{{< docs/play title="the Grafana Play site" url="https://play.grafana.org/a/grafana-lokiexplore-app/explore?var-ds=ddhr3fttaw8aod&var-patterns=&var-lineFilter=&var-logsFormat=" >}}

## Access in Grafana Cloud

To access Logs Drilldown:

1. Open your Grafana stack in a web browser.
1. In the main menu, select **Explore** > **Logs**.

## Installation

If you are not using Grafana Cloud, you can install Logs Drilldown in your Grafana environment.

### Install via Plugins catalog

For Enterprise and OSS Grafana users, you can install Logs Drilldown via the [Grafana Plugins catalog](https://grafana.com/grafana/plugins/grafana-lokiexplore-app/).

1. Open [https://grafana.com/grafana/plugins/grafana-lokiexplore-app/](https://grafana.com/grafana/plugins/grafana-lokiexplore-app/) in a web browser
1. Open the **Installation** tab.
1. Follow the instructions to install the app.

### Install in Loki

The following Loki and Grafana version and configuration are required:

- Grafana v11.2.0 or later
- Loki v3.2.0 or later

  - Enable pattern ingestion by setting `pattern-ingester.enabled` to `true`in your Loki configuration file.
  - Enable structured metadata by setting `allow_structured_metadata` to `true` within your Loki config file.
  - Enable the volume endpoint by setting `volume_enabled` to `true` within your Loki config file.

    ```yaml
    pattern_ingester:
      enabled: true
    limits_config:
      allow_structured_metadata: true
      volume_enabled: true
    ```

### Install via environment variable

If you want to [install the app in a docker container](https://grafana.com/docs/grafana/latest/setup-grafana/configure-docker/#install-plugins-in-the-docker-container), you need to configure the following environment variable:

```sh
GF_INSTALL_PLUGINS=https://storage.googleapis.com/integration-artifacts/grafana-lokiexplore-app/grafana-lokiexplore-app-latest.zip;grafana-lokiexplore-app
```

### Install using grafana-cli

You can install Logs Drilldown in your own Grafana instance using `grafana-cli`. For more information about `grafana-cli` refer to the [documentation](https://grafana.com/docs/grafana/latest/cli/.)

Using `grafana-cli` run the following command:

```sh
grafana-cli --pluginUrl=https://storage.googleapis.com/integration-artifacts/grafana-lokiexplore-app/grafana-lokiexplore-app-latest.zip plugins install grafana-lokiexplore-app
```

## Test with Docker Compose

You can test the app using the following command to spin up Grafana, Loki, and the Logs Drilldown App:

```sh
curl -L https://github.com/grafana/explore-logs/raw/main/scripts/run.sh | sh
```

This will download the [run.sh](https://github.com/grafana/explore-logs/blob/main/scripts/run.sh) file and execute it.

That shell file will download some configuration files into your `/tmp/explore-logs` directory and start the docker containers via `docker compose` from there.

Once the docker container has started, navigate to `http://localhost:3000/a/grafana-lokiexplore-app/explore` to access Logs Drilldown.

## Having trouble?

Refer to the [troubleshooting guide]({{< relref "../troubleshooting" >}}) for tips on how to solve common issues.

## What next?

Before you can use Logs Drilldown, an administrator must configure a Loki data source in order to access your logs in Logs Drilldown.
Refer to the [Loki data source documentation](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/data-sources/loki/) for instructions.
