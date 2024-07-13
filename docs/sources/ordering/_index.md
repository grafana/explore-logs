---
description: Learn about sorting and ordering data in Explore Logs
keywords:
  - Logs
  - Log Patterns
  - Explore
  - Patterns
  - Drain
  - Categorization
  - Analysis
menuTitle: Sorting and ordering
title: Sorting and ordering
weight: 400
---

{{< admonition type="caution" >}}  
Explore Logs is currently in [public preview](/docs/release-life-cycle/). Grafana Labs offers limited support, and breaking changes might occur prior to the feature being made generally available.
{{< /admonition >}}

# Sorting and ordering

![Screenshot of Explore Logs on a page with lots of graphs](../images/screenshots/sea-of-graphs.png)

If you find yourself on a page with lots of graphs, you might want to sort them in a way that makes sense to you. You can do this in Explore Logs using the **Sort by** dropdown in the top right toolbar.

By default the graphs are sorted by **Most relevant** where we prioritise graphs with more volatile data. For example, the graphs with the most spikes or dips will be shown first.

| Sort by option | Description                                               |
| -------------- | --------------------------------------------------------- |
| Most relevant  | Sorts graphs by the most volatile data.                   |
| Widest spread  | Sorts graphs that contain the largest standard deviation. |
| Name           | Sorts graphs alphabetically by name.                      |
| Highest spike  | Sorts graphs by the highest peaks.                        |
| Lowest dip     | Sorts graphs by the lowest dips.                          |
| Percentiles    | Sorts graphs by the nth percentile.                       |

{{< admonition type="note" >}}  
We are keen to improve this feature, so please [get in touch](https://forms.gle/1sYWCTPvD72T1dPH9) if there is something that would help you find the signal in the noise.
{{< /admonition >}}
