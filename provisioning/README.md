# Logs Explore App

> **__NOTE:__**  Logs Explore App is in an active development and currently available as preview

Logs Explore is a query-less experience for browsing Loki logs without the need to write complex queries. Discover or narrow down to find specific logs, uncover related logs and understand patterns — all with just a few clicks. No LogQL to be found anywhere! With Explore Logs, you can:

- Easily find logs for all of your services 
- Effortlessly filter logs based on their labels, fields or patterns
- Automatically choose the best visualization for your log data based on its characteristics, without any manual setup

...all of these without crafting a single query!

Access to Logs Explore is available both as a standalone feature and integrated within Dashboards.

![app](../imgs/service_index.png)

## Install in your own Grafana instance

You can install app in your own Grafana instance using following command:

```
grafana-cli --pluginUrl=https://storage.googleapis.com/grafana-lokiexplore-app/grafana-lokiexplore-app-latest.zip plugins install grafana-lokiexplore-app
```

## Test out with docker-compose

You can test out app in using following command to spin up Grafana, Loki and Logs Explore App:

```
docker-compose up
```

## Using Logs Explore App

1. Click on Explore > Logs in the main navigation bar
1. You’ll land on an service overview page that shows a time series and logs visualizations for all of the services in your selected Loki instance
1. You can change your data source with the drop-down on the top left
1. You can modify your time range in two ways: 
  - With the standard time range picker on the top right
  - By dragging and dropping the time range you want to see on any time series visualization
1. Services are shown based on volume of logs, and you can search for service you want trough Search service input
1. Select service you would like to explore that takes you to Service page
1. Filter logs based on strings, labels, detected fields or detected patterns

![app](../imgs/service_logs.png)

If you have a feedback, please leave an issue or contact us through [Grafana Logs Feedback](https://docs.google.com/forms/d/e/1FAIpQLSdcnzb0QYBqzp3RkrXIxqYKzDdw8gf0feZkOu4eZSIPyTUY1w/viewform).