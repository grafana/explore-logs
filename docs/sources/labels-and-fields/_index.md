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

{{< admonition type="caution" >}}  
Explore Logs is currently in [public preview](/docs/release-life-cycle/). Grafana Labs offers limited support, and breaking changes might occur prior to the feature being made generally available.
{{< /admonition >}}

![Screenshot of Explore Logs landing page](../images/screenshots/labels.png) 

# Labels and Fields

Explore Logs visualises log volumes for the labels attached to your log lines, and fields automatically extracted from the text of the line itself.

A special `detected_level` label is added to all log lines where Loki assigns a level of the log line, including `debug`, `info`, `warn`, `error`, `fatal`, `critical`, `trace`, or `unknown` if no level could be determined.

You can click **Select** on a Label or Field to access a breakdown of its values, seeing the log volumes visualized along the way.

This experience is useful for understanding the traits of your system, and for spotting spikes or other changes.

{{< admonition type="note" >}}
The type of data being expressed in a label or field may require different treatments. For example, fields expressing `bytes` are visualized differently than other types of data. Please [share your feedback](https://forms.gle/1sYWCTPvD72T1dPH9) if you have suggestions for how to improve this experience.
{{< /admonition >}}

## Guide

To explore labels with your own data, follow these steps:

1. In the main menu, select **Explore** > **Logs**.
1. Click the **Select** button for the **Service** you want to explore. ([No services?]({{< relref "../troubleshooting/#there-are-no-services" >}}))
1. Click the **Labels** tab.
1. Browse the labels detected for this service. ([No labels?]({{< relref "../troubleshooting/#there-are-no-labels" >}}))
1. Look for an interesting label and click the **Select** button.

You will see a selection of visualizations showing the volume of each one.

You can repeat the same steps in the **Fields** tab to see fields that were extracted from your log lines.

![Screenshot of Explore Logs landing page](../images/screenshots/fields.png)

## What next?

Learn about how [Log patterns]({{< relref "../patterns" >}}) can help you deal with different types of log lines in bulk.
