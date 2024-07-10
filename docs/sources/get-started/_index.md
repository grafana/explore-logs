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

{{< admonition type="caution" >}}  
Explore Logs is currently in [public preview](/docs/release-life-cycle/). Grafana Labs offers limited support, and breaking changes might occur prior to the feature being made generally available.
{{< /admonition >}}

# Get started with Explore Logs

The best way to see what Explore Logs can do for you is to use it to explore your own data.

{{< admonition type="note" >}}
See also instructions for how to [access or install Explore Logs]({{< relref "../access" >}}).
{{< /admonition >}}

## Guide

We will walk through a simple step-by-step guide providing a tour of Explore Logs.

While you are browsing around the app, look out for any unexpected spikes. Or perhaps one of your services is down and has stopped logging. Maybe you're seeing an increase in errors after a recent release.

To take a tour of Explore Logs, follow these steps:

1. In the main navigation bar click on **Explore** > **Logs**.
2. You’ll land on the **Service overview page** showing time series and log visualizations for all the services in your selected Loki instance. ([No services?]({{< relref "../troubleshooting/#there-are-no-services" >}}))
3. Change your data source with the drop-down on the top left, and select a recent time range.
{{< admonition type="tip" >}}
You can modify your time range in two ways:
   - With the standard time range picker on the top right.
   - By clicking and dragging the time range on any time series visualization.
{{< /admonition >}}
5. Services are shown based on the volume of logs, or you can search for the service by name.
6. Click **Select** on the service you would like to explore.
7. Click on the **Labels** tab to see visualizations of the log volume for each label. ([No labels?]({{< relref "../troubleshooting/#there-are-no-labels" >}}))
8. Select a label to see the log volume for each value of that label. <br><br> Explore Logs shows you the volume of logs with specific Labels and fields. Learn more about [Labels and Fields]({{< relref "../labels-and-fields" >}}).<br><br>

9. Select the **Fields** tab to see visualizations of the log volume for each Field. You can drill down in the same way.
10. Click on the **Patterns** tab to see the log volume for each automatically detected pattern. <br><br> Log patterns allow you to work with groups of similar log lines. You can hide them if they're noise, or focus in on them if they're useful. Learn more about [Log Patterns]({{< relref "../patterns" >}}).

### What do you think?

Please [share your feedback](https://forms.gle/1sYWCTPvD72T1dPH9) and help make Explore Logs better.
