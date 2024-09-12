---
canonical: https://grafana.com/docs/grafana/latest/explore/simplified-exploration/logs/get-started/
description: Provides a guided tour of the features in Explore Logs.
keywords:
  - Logs
  - Explore
  - Labels
  - Analysis
menuTitle: Get started
title: Get started with Explore Logs
weight: 300
---

# Get started with Explore Logs

{{< docs/public-preview product="Explore Logs" >}}

The best way to see what Explore Logs can do for you is to use it to explore your own data.
If you have a Grafana Cloud account can access Explore logs in Grafana Cloud by selecting **Explore** > **Logs**, or you can [install Explore Logs]({{< relref "../access" >}}) in your own Grafana instance.

To learn more, check out our overview video:

{{< youtube id="iH0Ufv2bD1U" >}}

## Guided tour

We will walk through a simple step-by-step guided tour of Explore Logs.

While you are browsing around the app, look out for any unexpected spikes in your logs. Or perhaps one of your services is down and has stopped logging. Maybe you're seeing an increase in errors after a recent release.

{{< figure alt="Explore Logs Service overview page" width="900px" align="center" src="../images/service_index.png" caption="Service Overview page" >}}

To take a tour of Explore Logs, follow these steps:

1. From the Grafana main menu, select **Explore** > **Logs**.
1. This opens the **Service overview page** showing time series and log visualizations for all the services in your selected Loki instance. ([No services?]({{< relref "../troubleshooting#there-are-no-services" >}}))
1. Change your data source from the menu on the top left, then select a recent time range. You can modify your time range in two ways:
   - With the standard time range picker on the top right.
   - By clicking and dragging the time range on any time series visualization.
1. Services are shown based on the volume of logs, or you can use the **Search Services** field to search for the service by name.
1. To explore logs for a service, slick the **Select** button on the service graph.
1. On the service details page, click the **Labels** tab to see visualizations of the log volume for each label. ([No labels?]({{< relref "../troubleshooting/#there-are-no-labels" >}}))
1. On the **Labels** tab, select a label to see the log volume for each value of that label.
   Explore Logs shows you the volume of logs with specific labels and fields. Learn more about [Labels and Fields]({{< relref "../labels-and-fields" >}}).
1. Select the **Fields** tab to see visualizations of the log volume for each field. You can select fields to drill down into the details in the same way as labels.
1. Click the **Patterns** tab to see the log volume for each automatically detected pattern.
   Log patterns let you work with groups of similar log lines. You can hide log patterns that are noisy, or focus only on the patterns that are most useful. Learn more about [Log Patterns]({{< relref "../patterns" >}}).

If you're having trouble using Explore Logs, check out our [troubleshooting guide]({{< relref "../troubleshooting" >}}).

## What do you think?

Please [share your feedback](https://forms.gle/1sYWCTPvD72T1dPH9) and help make Explore Logs better.
