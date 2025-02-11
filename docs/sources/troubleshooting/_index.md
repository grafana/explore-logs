---
canonical: https://grafana.com/docs/grafana/latest/explore/simplified-exploration/logs/troubleshooting/
description: Describes how to solve common issues when working with Grafana Logs Drilldown.
keywords:
  - Logs
  - Explore
  - Labels
  - Analysis
menuTitle: Troubleshooting
title: Troubleshooting Grafana Logs Drilldown
weight: 700
---

# Troubleshooting

This page address common issues when getting started and using Grafana Logs Drilldown.

## Ensure Loki is properly configured

To use Grafana Logs Drilldown, you need to have Loki properly configured. You can find full instructions on how to do this when [installing Grafana Logs Drilldown](https://grafana.com/docs/grafana-cloud/visualizations/simplified-exploration/logs/access/).

## There are no services

If everything is presented as an `unknown_service` when you access Grafana Logs Drilldown, you can try the following fixes:

1. Ensure the Volume API is enabled by setting the [`volume_enabled` configuration value](https://grafana.com/docs/loki/latest/configure/#:~:text=volume_enabled) in Loki. Enabled by default in Loki 3.1 and later.
1. Specify the label to use to identify services by setting the [`discover_service_name` configuration value](https://grafana.com/docs/loki/latest/configure/#:~:text=discover_service_name) in Loki.

## There are no detected levels

If you do not see `detected_level` values in Grafana Logs Drilldown, you can try the following fixes:

1. Ensure level detection is enabled by setting the [`discover_log_levels` configuration value](https://grafana.com/docs/loki/latest/configure/#:~:text=discover_log_levels). Enabled by default in Loki 3.1 and later.

## There are no labels

If you do not see any labels in Grafana Logs Drilldown, you can try the following fixes:

1. Ensure your collector is properly configured to attach them.

To learn more about Labels, refer to the [Loki labels documentation](https://grafana.com/docs/loki/latest/get-started/labels/).

## There are no patterns

Patterns are ephemeral and will only be available for the previous three hours.

If you aren't getting any patterns, you can try the following fixes:

1. Ensure pattern extraction is enabled by setting `--pattern-ingester.enabled=true` in your Loki config. [Learn about other necessary config](https://grafana.com/docs/grafana-cloud/visualizations/simplified-exploration/logs/access/).
1. It is possible that no patterns were detected, although this is rare - please [open an issue on GitHub](https://github.com/grafana/explore-logs/issues/new) or [get in touch privately](https://forms.gle/1sYWCTPvD72T1dPH9) so we can see what's going on.

## I cannot find something

Please [open an issue on GitHub](https://github.com/grafana/explore-logs/issues/new) or [get in touch privately](https://forms.gle/1sYWCTPvD72T1dPH9) and let us know what's not working for you.

If you have something urgent, please [get in touch via support](https://grafana.com/help/). Grafana Cloud users can [open a support ticket here](https://grafana.com/profile/org#support).
