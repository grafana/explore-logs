---
canonical: https://grafana.com/docs/grafana/latest/explore/simplified-exploration/logs/ordering/
description: Learn about sorting and ordering data in Grafana Logs Drilldown.
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

# Sorting and ordering

Some pages in Grafana Logs Drilldown can display a large number of graphs. You may want to sort the graphs differently, depending on what you're looking for. These pages let you modify the default sort oder using the **Sort by** menu in the top right toolbar.

You can use the **Asc/Desc** menu to change the direction of the sort.

## Sorting algorithms

{{< figure alt="Sort by many" width="900px" align="center" src="/media/docs/explore-logs/sort-by-dropdown.png" caption="Sort by menu" >}}

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
We are keen to improve this feature, so please [contact us](https://forms.gle/1sYWCTPvD72T1dPH9) if there is something that would help you find the signal in the noise.
{{< /admonition >}}
