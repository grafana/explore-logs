# Changelog

View [releases](https://github.com/grafana/explore-logs/releases/) on GitHub for up-to-date changelog information.

## - 0.1.3
## What's Changed
* added better hero image by @matryer in https://github.com/grafana/explore-logs/pull/598
* Updated plugin links to docs by @matryer in https://github.com/grafana/explore-logs/pull/599
* docs: Copyedit for style and docs standards by @JStickler in https://github.com/grafana/explore-logs/pull/582
* docs: embedded video by @matryer in https://github.com/grafana/explore-logs/pull/601
* docs: Fix heading levels by @JStickler in https://github.com/grafana/explore-logs/pull/602
* Docs update docs link by @matryer in https://github.com/grafana/explore-logs/pull/603
* docs: better sentence by @matryer in https://github.com/grafana/explore-logs/pull/604
* feat(log-context): add LogContext to logspanel by @svennergr in https://github.com/grafana/explore-logs/pull/607
* docs: more standardization edits by @JStickler in https://github.com/grafana/explore-logs/pull/605
* chore(main-release): bump patch version before doing a main build by @svennergr in https://github.com/grafana/explore-logs/pull/612
* docs: Update metadata with canonical URLs by @JStickler in https://github.com/grafana/explore-logs/pull/610
* Release 0.1.1 by @svennergr in https://github.com/grafana/explore-logs/pull/613
* chore: do not run release if triggered from drone by @svennergr in https://github.com/grafana/explore-logs/pull/615
* added a note about ephemeral patterns by @matryer in https://github.com/grafana/explore-logs/pull/619
* Value breakdowns: maintain filters between value changes by @matyax in https://github.com/grafana/explore-logs/pull/609
* Sorting: memoize sorting function by @matyax in https://github.com/grafana/explore-logs/pull/584
* Fields: fix loading forever when fields return empty by @gtk-grafana in https://github.com/grafana/explore-logs/pull/620
* Patterns: Show UI message when time range is too old to show patterns by @gtk-grafana in https://github.com/grafana/explore-logs/pull/618
* Chore: Clean up subscriptions by @gtk-grafana in https://github.com/grafana/explore-logs/pull/624
* Label queries: remove unneccessary filters and parsers in query expression by @svennergr in https://github.com/grafana/explore-logs/pull/628
* Service views: Prevent extra queries by @gtk-grafana in https://github.com/grafana/explore-logs/pull/629
* 0.1.2 by @svennergr in https://github.com/grafana/explore-logs/pull/634
* Variables: move variable lookup to getter functions by @matyax in https://github.com/grafana/explore-logs/pull/632
* LogsVolumePanel: support filtering logs from the selected level by @matyax in https://github.com/grafana/explore-logs/pull/474
* Order agnostic state comparison by @gtk-grafana in https://github.com/grafana/explore-logs/pull/633
* Logs Volume: track filtering interactions by @matyax in https://github.com/grafana/explore-logs/pull/644
* LogsVolumePanel: remove unneccessary filters and parsers in query expression by @gtk-grafana in https://github.com/grafana/explore-logs/pull/630
* feat(entrypoints): add entrypoints from panel and Explore by @svennergr in https://github.com/grafana/explore-logs/pull/639
* chore(scenes-upgrade): upgrade scenes and remove lazyloader by @svennergr in https://github.com/grafana/explore-logs/pull/648
* feat(feedback): move feedback button by @svennergr in https://github.com/grafana/explore-logs/pull/647
* feat(runtime-datasource): add runtime datasource by @svennergr in https://github.com/grafana/explore-logs/pull/649
* chore: upgrade augurs by @matyax in https://github.com/grafana/explore-logs/pull/650
* chore(docker-compose): move to `docker compose` command by @svennergr in https://github.com/grafana/explore-logs/pull/656
* Service selection: Replacing datasource resource calls with query runners by @gtk-grafana in https://github.com/grafana/explore-logs/pull/651
* Service selection: Custom filter value UI broken by @gtk-grafana in https://github.com/grafana/explore-logs/pull/661
* ServiceScene: Fix invalid queries being called when navigating to service selection by @gtk-grafana in https://github.com/grafana/explore-logs/pull/659
* Sorting: add outlier detection as a sorting option by @matyax in https://github.com/grafana/explore-logs/pull/658
* Service selection scene: get service volume by partial or exact match by @gtk-grafana in https://github.com/grafana/explore-logs/pull/666
* Patterns: Logs sample by @gtk-grafana in https://github.com/grafana/explore-logs/pull/430
* Service selection: fix log sample filtering by level selection by @matyax in https://github.com/grafana/explore-logs/pull/653
* Table: clear selected line from url state after the table is initialized by @gtk-grafana in https://github.com/grafana/explore-logs/pull/568
* Service selection: Results shown from wrong datasource after switching by @gtk-grafana in https://github.com/grafana/explore-logs/pull/668
* fix(lazy-loading): add missing `isLazy` property by @svennergr in https://github.com/grafana/explore-logs/pull/671
* Fields breakdown: lazy loader e2e test by @gtk-grafana in https://github.com/grafana/explore-logs/pull/669
* add play link to demonstrate product by @moxious in https://github.com/grafana/explore-logs/pull/673
* chore(deps): resolve `fast-loops` to `1.1.4` to prevent `CVE-2024-39008` notifications by @svennergr in https://github.com/grafana/explore-logs/pull/674
* Patterns: Use runtime datasource for queries by @gtk-grafana in https://github.com/grafana/explore-logs/pull/672
* Breakdowns: Level, detected level, level_extracted, oh my! by @gtk-grafana in https://github.com/grafana/explore-logs/pull/685
* Patterns: Legend selection not working by @gtk-grafana in https://github.com/grafana/explore-logs/pull/699
* ServiceScenes: Detected level variable not clearing after changing service by @gtk-grafana in https://github.com/grafana/explore-logs/pull/684
* fix: bad links by @gtk-grafana in https://github.com/grafana/explore-logs/pull/702
* Logs volume: Fix active state of series based on the filter's state by @matyax in https://github.com/grafana/explore-logs/pull/687
* ServiceScene: prevent services with a mix of json and logfmt from request looping by @gtk-grafana in https://github.com/grafana/explore-logs/pull/707
* chore: upgrade compose loki to enable aggregated metrics by @trevorwhitney in https://github.com/grafana/explore-logs/pull/712
* Detected labels: Runtime datasource refactor by @gtk-grafana in https://github.com/grafana/explore-logs/pull/682
* LogsVolumePanel: re-run query on filters change by @matyax in https://github.com/grafana/explore-logs/pull/719
* Filters: add support for filters with multiple values by @matyax in https://github.com/grafana/explore-logs/pull/718
* Value breakdowns: Add volume sort by @gtk-grafana in https://github.com/grafana/explore-logs/pull/722
* Value breakdowns: Add calculated sort by @gtk-grafana in https://github.com/grafana/explore-logs/pull/725
* Extract parser: update heuristic for mixed logs by @matyax in https://github.com/grafana/explore-logs/pull/717
* Service selection: limit number of services rendered in service selection by @gtk-grafana in https://github.com/grafana/explore-logs/pull/728

## New Contributors
* @moxious made their first contribution in https://github.com/grafana/explore-logs/pull/673

## - 0.1.2
## What's Changed
* added better hero image by @matryer in https://github.com/grafana/explore-logs/pull/598
* Updated plugin links to docs by @matryer in https://github.com/grafana/explore-logs/pull/599
* docs: Copyedit for style and docs standards by @JStickler in https://github.com/grafana/explore-logs/pull/582
* docs: embedded video by @matryer in https://github.com/grafana/explore-logs/pull/601
* docs: Fix heading levels by @JStickler in https://github.com/grafana/explore-logs/pull/602
* Docs update docs link by @matryer in https://github.com/grafana/explore-logs/pull/603
* docs: better sentence by @matryer in https://github.com/grafana/explore-logs/pull/604
* feat(log-context): add LogContext to logspanel by @svennergr in https://github.com/grafana/explore-logs/pull/607
* docs: more standardization edits by @JStickler in https://github.com/grafana/explore-logs/pull/605
* chore(main-release): bump patch version before doing a main build by @svennergr in https://github.com/grafana/explore-logs/pull/612
* docs: Update metadata with canonical URLs by @JStickler in https://github.com/grafana/explore-logs/pull/610
* Release 0.1.1 by @svennergr in https://github.com/grafana/explore-logs/pull/613
* chore: do not run release if triggered from drone by @svennergr in https://github.com/grafana/explore-logs/pull/615
* added a note about ephemeral patterns by @matryer in https://github.com/grafana/explore-logs/pull/619
* Value breakdowns: maintain filters between value changes by @matyax in https://github.com/grafana/explore-logs/pull/609
* Sorting: memoize sorting function by @matyax in https://github.com/grafana/explore-logs/pull/584
* Fields: fix loading forever when fields return empty by @gtk-grafana in https://github.com/grafana/explore-logs/pull/620
* Patterns: Show UI message when time range is too old to show patterns by @gtk-grafana in https://github.com/grafana/explore-logs/pull/618
* Chore: Clean up subscriptions by @gtk-grafana in https://github.com/grafana/explore-logs/pull/624
* Label queries: remove unneccessary filters and parsers in query expression by @svennergr in https://github.com/grafana/explore-logs/pull/628
* Service views: Prevent extra queries by @gtk-grafana in https://github.com/grafana/explore-logs/pull/629

**Full Changelog**: https://github.com/grafana/explore-logs/compare/v0.1.1...v0.1.2

## 0.1.1
* feat(log-context): add LogContext to logspanel [#607](https://github.com/grafana/explore-logs/pull/607)

## 0.1.0
* Release public preview version. 
