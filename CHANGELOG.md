# Changelog

View [releases](https://github.com/grafana/explore-logs/releases/) on GitHub for up-to-date changelog information.

## 1.0.6
* Line filters: Regex support by @gtk-grafana in https://github.com/grafana/explore-logs/pull/963
* Line filters: Allow backticks5 by @gtk-grafana in https://github.com/grafana/explore-logs/pull/992
* Fix: use urlUtil instead of UrlSearchParams by @gtk-grafana in https://github.com/grafana/explore-logs/pull/994
* Sorting: prevent sorting timeFields in place by @svennergr in https://github.com/grafana/explore-logs/pull/996
  
## 1.0.5
* feat(explorations): remove disabled state by @svennergr in https://github.com/grafana/explore-logs/pull/913
* Webpack: upgrade to 5.95 by @gtk-grafana in https://github.com/grafana/explore-logs/pull/914
* chore: cleanup faro error messages by @gtk-grafana in https://github.com/grafana/explore-logs/pull/915
* Logs Panel: move log panel options and add sort order by @gtk-grafana in https://github.com/grafana/explore-logs/pull/920
* Panel Menus by @gtk-grafana in https://github.com/grafana/explore-logs/pull/892
* fix(firefox-panel-hidden): add position absolute by @svennergr in https://github.com/grafana/explore-logs/pull/928
* SortLevelTransformation: account for possibly empty fields by @matyax in https://github.com/grafana/explore-logs/pull/929
* Chore: Better type safety with ts-reset by @gtk-grafana in https://github.com/grafana/explore-logs/pull/926
* Queries: remove placeholder query and sanitize stream selector by @matyax in https://github.com/grafana/explore-logs/pull/930
* Field labels: histogram option for numeric fields by @gtk-grafana in https://github.com/grafana/explore-logs/pull/924
* LogsVolumePanel: Add infinite scroll for logs and display visible range by @matyax in https://github.com/grafana/explore-logs/pull/925
* Upgrade scenes to v5.29.0 by @gtk-grafana in https://github.com/grafana/explore-logs/pull/938
* Breakdown panels: Add shared crosshairs by @gtk-grafana in https://github.com/grafana/explore-logs/pull/940
* Logs Panel: Combine wrapLogMessage with prettifyLogMessage by @matyax in https://github.com/grafana/explore-logs/pull/944
* Value breakdowns: Update UI by @gtk-grafana in https://github.com/grafana/explore-logs/pull/936
* Remove go to explore button, add PanelMenu to logs & table panels by @gtk-grafana in https://github.com/grafana/explore-logs/pull/942
* Timeseries panels: Map field display names to color by @gtk-grafana in https://github.com/grafana/explore-logs/pull/937
* Panels: Keybindings by @gtk-grafana in https://github.com/grafana/explore-logs/pull/946
* chore: update livereload plugin port by @fcjack in https://github.com/grafana/explore-logs/pull/948
* fix(LogsVolumePanel): fix display of visible range when using cached data by @matyax in https://github.com/grafana/explore-logs/pull/955
* Line filter: add case sensitive line filter state to local storage by @gtk-grafana in https://github.com/grafana/explore-logs/pull/956
* Keybindings: support time range copy/paste  by @gtk-grafana in https://github.com/grafana/explore-logs/pull/960
* Logs Volume: Set relative height and allow to collapse by @matyax in https://github.com/grafana/explore-logs/pull/964
* Logs Tab: Show log line count by @gtk-grafana in https://github.com/grafana/explore-logs/pull/951
* Logs panel: update service data when receiving new logs by @matyax in https://github.com/grafana/explore-logs/pull/967
* fix(panel-menu): menu throwing error in logs table by @svennergr in https://github.com/grafana/explore-logs/pull/968
* fix(panelmenu): `Investigations` causing multiple same keys by @svennergr in https://github.com/grafana/explore-logs/pull/965
* feat(patterns): use grafana's calculated `interval` as `step` by @svennergr in https://github.com/grafana/explore-logs/pull/974
* Table: Show log text not preserved in URL state by @gtk-grafana in https://github.com/grafana/explore-logs/pull/979
* Table: Column order not preserved in URL by @gtk-grafana in https://github.com/grafana/explore-logs/pull/978
* chore: run `yarn audit fix` by @gtk-grafana in https://github.com/grafana/explore-logs/pull/982
* Update `make docs` procedure by @github-actions in https://github.com/grafana/explore-logs/pull/972
* Add support to generate OTEL logs in generate script by @shantanualsi in https://github.com/grafana/explore-logs/pull/973
* Logs: Issue queries in forward or backward direction depending on the selected sorting option by @matyax in https://github.com/grafana/explore-logs/pull/970
* Breakdowns: Add share menu by @gtk-grafana in https://github.com/grafana/explore-logs/pull/983
* chore: clean up copy texts by @gtk-grafana in https://github.com/grafana/explore-logs/pull/987
* Logs panel: Direction and wrap URL state by @gtk-grafana in https://github.com/grafana/explore-logs/pull/985
  
## 1.0.4
* fix: console error when undefined jsondata.interval by @gtk-grafana in https://github.com/grafana/explore-logs/pull/877
* ServiceSelectionScene: Manual query runners by @gtk-grafana in https://github.com/grafana/explore-logs/pull/868
* Detected fields: Use detected_fields response to determine if avg_over_time query should be run by @gtk-grafana in https://github.com/grafana/explore-logs/pull/871
* feat(combineResponses): improve label comparison performance by @matyax in https://github.com/grafana/explore-logs/pull/880
* chore: bump @bsull/augurs to 0.6.0 by @sd2k in https://github.com/grafana/explore-logs/pull/882
* Labels variable: Combobox by @gtk-grafana in https://github.com/grafana/explore-logs/pull/878
* Chore: Rename the sorting option in explore metrics by @itsmylife in https://github.com/grafana/explore-logs/pull/883
* Go to Explore button: keep visual preferences in Explore link by @matyax in https://github.com/grafana/explore-logs/pull/885
* Service selection: Label selection UI by @gtk-grafana in https://github.com/grafana/explore-logs/pull/881
* Fix favoriting on label select by @gtk-grafana in https://github.com/grafana/explore-logs/pull/908
* Panel UI: Numeric filtering by @gtk-grafana in https://github.com/grafana/explore-logs/pull/894
  
## 1.0.3
* feat(exploration): add `grafana-lokiexplore-app/metric-exploration/v1` entrypoint by @svennergr in https://github.com/grafana/explore-logs/pull/840
* Initial label docs by @stevendungan in https://github.com/grafana/explore-logs/pull/853
* chore(intercept-banner): move into `container` by @svennergr in https://github.com/grafana/explore-logs/pull/854
* Logs panel: add button to copy link to log line by @matyax in https://github.com/grafana/explore-logs/pull/855
* fix: fix broken tsc-files command by @gtk-grafana in https://github.com/grafana/explore-logs/pull/860
* Add conditional extension point for testing sidecar functionality by @aocenas in https://github.com/grafana/explore-logs/pull/828
* Ad hoc variables: add support for detected_field/.../values by @gtk-grafana in https://github.com/grafana/explore-logs/pull/848
* Fix: tsc-files ignores tsconfig.json when called through husky hooks by @gtk-grafana in https://github.com/grafana/explore-logs/pull/867
* Config: Administrator config - max interval by @gtk-grafana in https://github.com/grafana/explore-logs/pull/843
* feat(shardSplitting): improve error handling by @matyax in https://github.com/grafana/explore-logs/pull/873
  
## 1.0.2
* Module: Split it up + heavy refactor by @gtk-grafana in https://github.com/grafana/explore-logs/pull/768
* Breakdowns: Remove service_name requirement by @gtk-grafana in https://github.com/grafana/explore-logs/pull/801
* docs: update installation instructions by @JStickler in https://github.com/grafana/explore-logs/pull/815
* Shard query splitting: use dynamic grouping by @matyax in https://github.com/grafana/explore-logs/pull/814
* fix(routing): check for sluggified value in URL by @matyax in https://github.com/grafana/explore-logs/pull/817
* Shard query splitting: add retrying flag to prevent cancelled requests by @matyax in https://github.com/grafana/explore-logs/pull/818
* Service selection: Showing incorrect list of services after changing datasource on breakdown views by @gtk-grafana in https://github.com/grafana/explore-logs/pull/811
* Service selection: Starting with labels besides service_name by @gtk-grafana in https://github.com/grafana/explore-logs/pull/813
* chore: upgrade grafana deps to 11.2.x and update extensions to use `addLink` by @svennergr in https://github.com/grafana/explore-logs/pull/824
* Patterns: Fix broken data link in pattern viz by @gtk-grafana in https://github.com/grafana/explore-logs/pull/831
* Shard query splitting: limit group size to be less than the remaining shards by @matyax in https://github.com/grafana/explore-logs/pull/829
* Patterns: fix flashing no patterns UI when loading by @gtk-grafana in https://github.com/grafana/explore-logs/pull/833
* Bundlewatch by @gtk-grafana in https://github.com/grafana/explore-logs/pull/830
* Bundlewatch: add main as base branch by @gtk-grafana in https://github.com/grafana/explore-logs/pull/836
* Primary label selection: Better empty volume UI by @gtk-grafana in https://github.com/grafana/explore-logs/pull/835
* Structured metadata: Refactor into new variable by @gtk-grafana in https://github.com/grafana/explore-logs/pull/826
* Breakdowns: Changing primary label doesn't update tab count by @gtk-grafana in https://github.com/grafana/explore-logs/pull/845
* Structured metadata: Changes to ad-hoc variable doesn't run detected_fields  by @gtk-grafana in https://github.com/grafana/explore-logs/pull/849
  
## 1.0.0
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
