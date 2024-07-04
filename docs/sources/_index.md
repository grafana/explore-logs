---
title: Explore Logs documentation
description: Documentation for Explore Logs
weight: 100
cards:
  title_class: pt-0 lh-1
  items:
    - title: Get started
      href: ./get-started/
      description: Install Explore Logs and take a tour of Explore Logs using your own data.
      height: 24
    - title: Labels and Detected fields
      href: ./labels-and-detected-fields/
      description: Learn how Explore Logs uses labels and detected fields to help you explore your Loki logs.
      height: 24
    - title: Log patterns
      href: ./patterns/
      description: Learn how you can use automatic log grouping to remove noise and find hard to locate logs.
      height: 24
---

# Explore Logs documentation

{{% admonition type="caution" %}}
Explore Logs is currently in [public preview](/docs/release-life-cycle/). Grafana Labs offers limited support, and breaking changes might occur prior to the feature being made generally available.
{{% /admonition %}}

Explore Logs automatically visualises insights from your Loki logs. You can:

* Drill into your data using volume and text patterns
* Easily find logs and log volumes for all of your services
* Effortlessly filter logs based on their labels, fields, or patterns
* Uncover related logs and monitor changes over time
* Browse automatic visualizations of your log data based on its characteristics
* Do all of this without writing LogQL queries

{{< docs/hero-simple key="hero" >}}

## Who is Explore Logs for?

Explore Logs is for all engineers. 

Traditionally you'd need to learn LogQL and build a deep understanding of your systems in order to answer questions and get the most out of Loki. With Explore Logs, you get the same powerful insights, by just clicking around.

## What next?

Dive into the [Get started with Explore Logs]({{< relref "get-started" >}}) article to learn how to set up Explore Logs and take a tour of the feature on your own data. 

