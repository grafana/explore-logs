---
description: Learn how breaking logs down by Labels and Detected fields can help you find the signal in the noise.
keywords:
  - Logs
  - Explore
  - Labels
  - Analysis
menuTitle: Labels and detected fields
title: Labels and detected fields
weight: 800
---

# Labels and Detected fields

Explore Logs shows you the volume of logs with specific Labels and Detected fields.

Labels are attached to your log lines when they are collected from the source.

Detected fields are automatically extracted from the log text.

You can click **Select** on a Label or Detected field to access a breakdown of its values, seeing the log volumes visualized along the way.

This experience is useful for understanding the traits of your system, and for spotting spikes or other changes.

## Guide

To explore labels with your own data, follow these steps:

1. Open **Explore Logs**
2. Select a **Service** and click **Select**
3. Click on the **Labels** tab
4. Browse the labels detected for this service
5. Look for an interesting value and click **Select**

You will see a selection of visualizations showing the volume of each one.

You can repeat the same steps in the **Detected fields** tab to see fields that were automatically extracted from your log lines.

## What next?

Learn about how [Log patterns]({{< relref "./patterns" >}}) can help you deal with different types of log lines in bulk.
