---
description: Learn how breaking logs down by Labels and Fields can help you find the signal in the noise.
keywords:
  - Logs
  - Explore
  - Labels
  - Analysis
menuTitle: Labels and Fields
title: Labels and Fields
weight: 300
---

# Labels and Fields

{{% admonition type="caution" %}}
Explore Logs is currently in [public preview](/docs/release-life-cycle/). Grafana Labs offers limited support, and breaking changes might occur prior to the feature being made generally available.
Please [send us any feedback](https://forms.gle/1sYWCTPvD72T1dPH9).
{{% /admonition %}}

Explore Logs shows you the volume of logs with specific labels attached to your log lines and fields automatically extracted from the log lines themselves.

You can click **Select** on a Label or Field to access a breakdown of its values, seeing the log volumes visualized along the way.

This experience is useful for understanding the traits of your system, and for spotting spikes or other changes.

## Guide

To explore labels with your own data, follow these steps:

1. In the main menu, select **Explore** > **Logs**.
1. Click the **Select** button for the service you want to explore.
1. Click the **Labels** tab.
1. Browse the labels detected for this service.
1. Look for an interesting label and click the **Select** button.

You will see a selection of visualizations showing the volume of each one.

If you do not see any labels, ensure your collector is properly configured to attach them. Alternatively, you can repeat the same steps in the **Fields** tab to see fields that were extracted from your log lines.

## What next?

Learn about how [Log patterns]({{< relref "../patterns" >}}) can help you deal with different types of log lines in bulk.
