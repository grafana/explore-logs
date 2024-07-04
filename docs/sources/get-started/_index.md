---
description: Get set up and take a tour of Explore Logs.
keywords:
  - Logs
  - Explore
  - Labels
  - Analysis
menuTitle: Get started
title: Get started with Explore Logs
weight: 200
---

# Get started with Explore Logs

{{% admonition type="caution" %}}
Explore Logs is currently in [public preview](/docs/release-life-cycle/). Grafana Labs offers limited support, and breaking changes might occur prior to the feature being made generally available.
Please [send us any feedback](https://forms.gle/1sYWCTPvD72T1dPH9).
{{% /admonition %}}

The best way to see what Explore Logs can do for you is to use it to explore your own data.

## Guide

We will walk through a simple step-by-step guide providing a tour of Explore Logs.

{{% admonition type="tip" %}}
Instructions for how to access or install Explore Logs are below.
{{% /admonition %}}

While you are browsing around the app, look out for any unexpected spikes. Or perhaps one of your services is down and has stopped logging. Maybe you're seeing an increase in errors after a recent release.

To take a tour of Explore Logs, follow these steps:

1. In the main navigation bar click on **Explore** > **Logs**.
2. You’ll land on the **Service overview page** showing time series and log visualizations for all the services in your selected Loki instance. ([No services?]({{< relref "../troubleshooting/#there-are-no-services" >}}))
3. Change your data source with the drop-down on the top left, and select a recent time range.
{{% admonition type="tip" %}}
Modify your time range in two ways:
   - With the standard time range picker on the top right.
   - By clicking and dragging the time range on any time series visualization.
{{% /admonition %}}
5. Services are shown based on the volume of logs, or you can search for the service by name.
6. Click **Select** on the service you would like to explore.
7. Click on the **Labels** tab to see visualizations of the log volume for each label. ([No labels?]({{< relref "../troubleshooting/#there-are-no-labels" >}}))
8. Select a label to see the log volume for each value of that label.

{{% admonition type="Learn more" %}}
Explore Logs shows you the volume of logs with specific Labels and fields.

**What next?** Learn more about [Labels and Fields]({{< relref "../labels-and-fields" >}}).
{{% /admonition %}}

9. Select the **Fields** tab to see visualizations of the log volume for each Field. You can drill down in the same way.
10. Click on the **Patterns** tab to see the log volume for each automatically detected pattern.

{{% admonition type="Learn more" %}}
Log patterns allow you to work with groups of similar log lines. You can hide them if they're noise, or focus in on them if they're useful.

**What next?** Learn more about [Log Patterns]({{< relref "../patterns" >}}).
{{% /admonition %}}

## Access in Grafana Cloud

Explore Logs is already available in Grafana Cloud.

To access Explore Logs:

1. Open your Grafana stack in a web browser
1. In the main menu, select **Explore** > **Logs**.

### Install via environment variable

If you want to [install the app in a docker container](https://grafana.com/docs/grafana/latest/setup-grafana/configure-docker/#install-plugins-in-the-docker-container), you need to configure the following environment variable:

```
GF_INSTALL_PLUGINS=https://storage.googleapis.com/integration-artifacts/grafana-lokiexplore-app/grafana-lokiexplore-app-latest.zip;grafana-lokiexplore-app
```

## Install using grafana-cli

You can install Explore Logs in your own Grafana instance using `grafana-cli`:
> The following Loki and Grafana version and configuration are required:
> - Loki v3.0+
>   - `--pattern-ingester.enabled=true` for pattern ingestion
>   -  Volume endpoint enabled in Loki config:
> ```yaml
>limits_config:
>  volume_enabled: true
>```
> - Grafana v11.0+

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
