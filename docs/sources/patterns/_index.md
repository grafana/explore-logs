---
description: Use Log patterns to detect and analyze types of log lines.
keywords:
  - Logs
  - Log Patterns
  - Explore
  - Patterns
  - Drain
  - Categorization
  - Analysis
menuTitle: Log patterns
title: Log patterns
weight: 400
---

{{< admonition type="caution" >}}  
Explore Logs is currently in [public preview](/docs/release-life-cycle/). Grafana Labs offers limited support, and breaking changes might occur prior to the feature being made generally available.
{{< /admonition >}}

# Log patterns

Log patterns allow you to work with groups of similar log lines. You can hide them if they're noise, or focus in on them if they're useful.

Patterns are automatically extracted when your logs are ingested.

The Explore Logs app shows you the patterns alongside their log volumes. From this view, you can investigate spikes and include or exclude those log lines from your view.

Patterns are ephemeral and can change over time as your logging evolves.

## More use cases

Log patterns allow you to:

* Browse the log volume over time of different types of logs.
* Simplify log management by grouping similar log entries.
* Enhance log searches by focusing on relevant patterns.
* Improve troubleshooting efficiency by highlighting critical log lines.
* Reduce storage requirements by minimizing log data.
* Filter out noisy log lines during exploration.
* Identify specific log lines for targeted analysis.

## Quick guides

We've outlined the steps you'll need to take to perform these common use cases.

### Browse log volumes by type

Explore Logs proactively visualizes your log volume data per detected pattern, broken down in various ways. At a glance you can immediately spot spikes or other changes.

For example, if your HTTP service is suffering from a DDoS attack, the relevant graphs will clearly show the spikes. From here you can drill down to discover enough details about the attack to counter it.

### Targetted analysis

If you know the kind of log line you're looking for, Log patterns are an easy way to get everything else out of the way.

To view only a specific set of patterns, perform the following steps:

1. In the main menu, select **Explore** > **Logs**.
2. Select the relevant **Service**. ([No services?]({{< relref "../troubleshooting/#there-are-no-services" >}}))
3. Click the **Patterns** tab.
4. Identify a pattern that matches the type of logs you're interested in viewing. ([No patterns?]({{< relref "../troubleshooting/#there-are-no-patterns" >}}))
5. Click the **Include** button.
6. Return to the **Logs** tab and notice the filtered view.

### Hide noisy log lines

To hide noisy log lines, perform the following steps:

1. In the main menu, select **Explore** > **Logs**.
2. Select the relevant **Service**. ([No services?]({{< relref "../troubleshooting/#there-are-no-services" >}}))
3. Open the **Patterns** tab.
4. Identify a pattern that represents noise in the logs that you want to remove. ([No patterns?]({{< relref "../troubleshooting/#there-are-no-patterns" >}}))
5. Click the **Exclude** button to exclude that pattern.
6. Return to the **Logs** tab and notice the noisy pattern has been removed.

You can repeat steps 4 and 5 to exclude multiple patterns.

## Pattern extraction

Loki extracts patterns from a stream of log lines.

For example, if your service logs lines like this:

```
duration=255ms trace_id=abc001 GET /path/to/endpoint/2
user loaded: 25666
user loaded: 14544
duration=255ms trace_id=abc002 POST /path/to/endpoint/2
user loaded: 25666
duration=355ms trace_id=abc003 GET /path/to/endpoint/1
duration=355ms trace_id=abc004 POST /path/to/endpoint/1
duration=255ms trace_id=abc005 POST /path/to/endpoint/2
user loaded: 89255
duration=4244ms trace_id=abc006 GET /path/to/endpoint/1
user loaded: 25666
duration=255ms trace_id=abc007 GET /path/to/endpoint/2
```

Two patterns would emerge where the static tokens are preserved literally, and dynamic values are turned into placeholders:

Pattern 1: `duration=<_> trace_id=<_> <_> /path/to/endpoint/<_>`

Pattern 2: `user loaded: <_>`

{{% admonition type="note" %}}
Since Loki 3.0, you can make queries using this simplified template format which is much faster than using regex.
{{% /admonition %}}

## What next?

See how Explore Logs works on your own data by following our [Get started guide]({{< relref "../get-started" >}}).
