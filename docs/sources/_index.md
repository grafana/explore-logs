---
title: Explore Logs
canonical: https://grafana.com/docs/grafana/latest/explore/simplified-exploration/logs/
description: Learn about the new experience for browsing your Loki logs without writing queries.
weight: 100
hero:
  title: Explore Logs
  level: 1
  width: 100
  height: 100
  description: Explore Logs automatically visualizes insights from your Loki logs.
cards:
  title_class: pt-0 lh-1
  items:
    - title: Get access or install
      href: ./access/
      description: Get access to Explore Logs in Grafana Cloud or in your own stack.
      height: 24
    - title: Get started
      href: ./get-started/
      description: Install Explore Logs and take a tour of Explore Logs using your own data.
      height: 24
    - title: Learn about Labels and Fields
      href: ./labels-and-fields/
      description: Learn how Explore Logs uses labels and Fields to help you explore your Loki logs.
      height: 24
    - title: Learn about Log patterns
      href: ./patterns/
      description: Learn how you can use automatic log grouping to remove noise and find hard to locate logs.
      height: 24
    - title: Troubleshooting
      href: ./troubleshooting/
      description: Find solutions to common issues you might encounter when using Explore Logs.
      height: 24
    - title: Give feedback
      href: https://forms.gle/1sYWCTPvD72T1dPH9
      description: Share your thoughts on Explore Logs and help us improve the experience.
      height: 24
---

# Explore Logs

Welcome to our new experience for Loki. Explore Logs lets you automatically visualize and explore your logs without having to write queries.
Using Explore Logs you can:

- Easily find logs and log volumes for all of your services.
- Effortlessly filter logs based on their labels, fields, or patterns.
- Drill into your data using volume and text patterns.
- Uncover related logs and monitor changes over time.
- Browse automatic visualizations of your log data based on its characteristics.
- Do all of this without writing LogQL queries.

{{< docs/play title="Explore Logs" url="https://play.grafana.org/a/grafana-lokiexplore-app/explore" >}}

## Who is Explore Logs for?

Explore Logs is for engineers of all levels of operational expertise. You no longer need to be an SRE wizard to get value from your logs.

Traditionally, you'd need a deep understanding of your systems and Loki's query language, LogQL, in order to get the most out of Loki.

With Explore Logs, you get the same powerful insights, by just viewing and clicking in visualizations which are automatically generated from your log data.

## Explore

{{< card-grid key="cards" type="simple" >}}

## Please share your feedback

Our new experiences are in their early stages, and we'd love to hear your feedback.

- You'll find a **Give feedback** link on each Explore Logs page.
- You can also fill out [this Google form](https://forms.gle/1sYWCTPvD72T1dPH9) to send your thoughts directly to the team building the apps.

## What's next?

Dive into [Get started with Explore Logs]({{< relref "./get-started" >}}) to learn how to set up Explore Logs and take a tour of the feature using your own data.
