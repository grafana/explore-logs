---
canonical: https://grafana.com/docs/grafana/latest/explore/simplified-exploration/logs/access/
description: Describes how to access Explore Logs in Grafana Cloud and the different installation methods for self-hosted Grafana.
keywords:
  - Logs
  - Explore
  - Labels
  - Analysis
menuTitle: Access or Install
title: Access or install Explore Logs
weight: 200
---

# Access or install Explore Logs

{{< docs/public-preview product="Explore Logs" >}}

To use Explore Logs on your own data, you can either access it in Grafana Cloud or install it in your own Grafana instance.

{{< docs/play title="the Grafana Play site" url="https://play.grafana.org/a/grafana-lokiexplore-app/explore?var-ds=ddhr3fttaw8aod&var-patterns=&var-lineFilter=&var-logsFormat=" >}}

## Access in Grafana Cloud

Explore Logs is enabled for Private Preview in Grafana Cloud.

To access Explore Logs:

1. Open your Grafana stack in a web browser.
1. In the main menu, select **Explore** > **Logs**.

## Installation

If you are not using Grafana Cloud, you can install Explore Logs in your Grafana environment.

### Install via Plugins catalog

For Enterprise and OSS Grafana users, you can install Explore Logs via the [Grafana Plugins catalog](https://grafana.com/grafana/plugins/grafana-lokiexplore-app/).

1. Open [https://grafana.com/grafana/plugins/grafana-lokiexplore-app/](https://grafana.com/grafana/plugins/grafana-lokiexplore-app/) in a web browser
1. Open the **Installation** tab.
1. Follow the instructions to install the app.

### Install in Loki

The following Loki and Grafana version and configuration are required:

- Grafana v11.0.0+
- Loki v3.0.0+
  - Enable pattern ingestion by setting `--pattern-ingester.enabled=true` in your Loki configuration.
  - Enable the volume endpoint in your Loki configuration:

      ```yaml
      limits_config:
        volume_enabled: true
      ```

### Install via environment variable

If you want to [install the app in a docker container](https://grafana.com/docs/grafana/latest/setup-grafana/configure-docker/#install-plugins-in-the-docker-container), you need to configure the following environment variable:

```sh
GF_INSTALL_PLUGINS=https://storage.googleapis.com/integration-artifacts/grafana-lokiexplore-app/grafana-lokiexplore-app-latest.zip;grafana-lokiexplore-app
```

### Install using grafana-cli

You can install Explore Logs in your own Grafana instance using `grafana-cli`.

Using `grafana-cli` run the following command:

```sh
grafana-cli --pluginUrl=https://storage.googleapis.com/integration-artifacts/grafana-lokiexplore-app/grafana-lokiexplore-app-latest.zip plugins install grafana-lokiexplore-app
```

## Test with Docker Compose

You can test the app using the following command to spin up Grafana, Loki, and the Explore Logs App:

```sh
curl -L https://github.com/grafana/explore-logs/raw/main/scripts/run.sh | sh
```

This will download the [run.sh](https://github.com/grafana/explore-logs/blob/main/scripts/run.sh) file and execute it.

That shell file will download some configuration files into your `/tmp/explore-logs` directory and start the docker containers via `docker compose` from there.

Once the docker container has started, navigate to `http://localhost:3000/a/grafana-lokiexplore-app/explore` to access Explore Logs.

## Having trouble?

Check out our [troubleshooting guides]({{< relref "../troubleshooting" >}}) for tips on how to solve common issues.

## What next?

Once you're set up, you'll need to configure a data source in order to access your logs in Explore Logs. Our Get Started guide includes a section on how to [set up a new Loki datasource]({{< relref "../get-started#set-up-a-new-loki-datasource" >}}).
