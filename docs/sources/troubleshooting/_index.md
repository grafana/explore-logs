---
description: Solve common issues when working with Explore Logs.
keywords:
  - Logs
  - Explore
  - Labels
  - Analysis
menuTitle: Troubleshooting
title: Troubleshooting Explore Logs
weight: 700
---

{{< admonition type="caution" >}}  
Explore Logs is currently in [public preview](/docs/release-life-cycle/). Grafana Labs offers limited support, and breaking changes might occur prior to the feature being made generally available.
{{< /admonition >}}

# Troubleshooting

This page address common issues when getting started and using Explore Logs.

## There are no services

If everything is presented as an `unknown_service` when you access Explore Logs, you can try the following fixes:

1. Ensure the Volume API is enabled by setting the [`volume_enabled` configuration value](https://grafana.com/docs/loki/latest/configure/#:~:text=volume_enabled) in Loki. Enabled by default in Loki 3.1 and later.
1. Specify the label to use to identify services by setting the [`discover_service_name` configuration value](https://grafana.com/docs/loki/latest/configure/#:~:text=discover_service_name) in Loki.

## There are no detected levels

If you do not see `detected_level` values in Explore Logs, you can try the following fixes:

1. Ensure level detection is enabled by setting the [`discover_log_levels` configuration value](https://grafana.com/docs/loki/latest/configure/#:~:text=discover_log_levels). Enabled by default in Loki 3.1 and later.

## There are no labels

If you do not see any labels in Explore Logs, you can try the following fixes:

1. Ensure your collector is properly configured to attach them.

{{< admonition type="note" >}}
To learn more about Labels, check out the [Understand labels article](https://grafana.com/docs/loki/latest/get-started/labels/).
{{< /admonition >}}

## There are no patterns

Patterns are ephemeral and will only be available for the last 3 hours.

If you aren't getting any patterns, you can try the following fixes:

1. Ensure pattern extraction is enabled by setting `--pattern-ingester.enabled=true` in your Loki config. [Learn about other necessary config](http://localhost:3002/docs/explore-logs/latest/get-started/#install-using-grafana-cli).
1. It is possible that no patterns were detected, although this is rare - please [get in touch](https://forms.gle/1sYWCTPvD72T1dPH9) so we can see what's going on.

## I cannot find something

Please [get in touch with the team building the app](https://forms.gle/1sYWCTPvD72T1dPH9) and let us know what's not working for you.
