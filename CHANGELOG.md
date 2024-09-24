# Changelog

View [releases](https://github.com/grafana/explore-logs/releases/) on GitHub for up-to-date changelog information.

## 1.0.0
## What's Changed
* fix(shardQuerySplitting): do not emit empty data by @matyax in https://github.com/grafana/explore-logs/pull/793
* removed preview warning and updated some copy (added link to support) by @matryer in https://github.com/grafana/explore-logs/pull/792
* Frontend instrumentation by @gtk-grafana in https://github.com/grafana/explore-logs/pull/790
* Aggregated metrics: Use sum_over_time query for aggregated metric queries by @gtk-grafana in https://github.com/grafana/explore-logs/pull/789
* fix: fall back to mixed parser if the field is missing parser in url parameter by @gtk-grafana in https://github.com/grafana/explore-logs/pull/788
* Update workflows to use actions that don't need organization secrets by @svennergr in https://github.com/grafana/explore-logs/pull/784
* label values: fix label values stuck in loading state by @gtk-grafana in https://github.com/grafana/explore-logs/pull/783
* Shard query splitting: send the whole stream selector to fetch shard values by @gtk-grafana in https://github.com/grafana/explore-logs/pull/782
* chore(shardQuerySplitting): start in Streaming state by @BitDesert in https://github.com/grafana/explore-logs/pull/781
* fix(patterns-breakdown): fix expression to create pattern key breakdown by @gtk-grafana in https://github.com/grafana/explore-logs/pull/780
* fix(service-selection-scrolling): remove forced overflow scroll by @matyax in https://github.com/grafana/explore-logs/pull/779
* GA: remove preview badge by @gtk-grafana in https://github.com/grafana/explore-logs/pull/778
* GA: Remove preview copy in intercept banner by @gtk-grafana in https://github.com/grafana/explore-logs/pull/777
  
## 0.1.4
## What's Changed
* Fields: include and exclude empty values by @gtk-grafana in https://github.com/grafana/explore-logs/pull/703
* Update `make docs` procedure by @github-actions in https://github.com/grafana/explore-logs/pull/716
* Displayed fields: persist selection in local storage and URL by @matyax in https://github.com/grafana/explore-logs/pull/733
* Sync loki versions in docker-compose.dev.yaml by @gtk-grafana in https://github.com/grafana/explore-logs/pull/745
* fix: grafana image tag by @BitDesert in https://github.com/grafana/explore-logs/pull/743
* generator: add new service with mix of json and logfmt by @gtk-grafana in https://github.com/grafana/explore-logs/pull/749
* Logs Volume Panel: properly handle "logs" detected level by @matyax in https://github.com/grafana/explore-logs/pull/751
* feat(detected-fields): use `/detected_fields` API by @svennergr in https://github.com/grafana/explore-logs/pull/736
* enable sharding in docker containers by @gtk-grafana in https://github.com/grafana/explore-logs/pull/754
* Line filter: Case sensitive search by @gtk-grafana in https://github.com/grafana/explore-logs/pull/744
* Shard query splitting: Split queries by stream shards by @matyax in https://github.com/grafana/explore-logs/pull/715
* chore: replace react-beautiful-dnd with successor by @gtk-grafana in https://github.com/grafana/explore-logs/pull/579
* Service selection: show previous filter text in service search input by @gtk-grafana in https://github.com/grafana/explore-logs/pull/763
* feat(generator): log `traceID` as structured metadata by @svennergr in https://github.com/grafana/explore-logs/pull/766
* Labels: Fix labels list not updating when detected_labels loads while user is viewing another tab by @gtk-grafana in https://github.com/grafana/explore-logs/pull/757
* Fields: Fix incorrect field count by @gtk-grafana in https://github.com/grafana/explore-logs/pull/761
* Link extensions: fix services with slash by @gtk-grafana in https://github.com/grafana/explore-logs/pull/770
  
## New Contributors
* @moxious made their first contribution in https://github.com/grafana/explore-logs/pull/673
* @github-actions made their first contribution in https://github.com/grafana/explore-logs/pull/716
* @BitDesert made their first contribution in https://github.com/grafana/explore-logs/pull/743
  
## 0.1.3
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

## New Contributors
* @moxious made their first contribution in https://github.com/grafana/explore-logs/pull/673

## 0.1.2
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
