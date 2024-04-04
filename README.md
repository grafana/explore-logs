# Logs Explore App

> **__NOTE:__** The Logs Explore App is actively being developed and is currently available as a preview.

Logs Explore offers a query-less experience for browsing Loki logs without the need for writing complex queries. Discover or narrow down your search to find logs for your service, uncover related logs, and understand patterns—all with just a few clicks. No LogQL required! With Explore Logs, you can:

- Easily find logs for all of your services.
- Effortlessly filter service logs based on their labels, fields, or patterns.
- Automatically choose the best visualization for your log data based on its characteristics, without any manual setup.

...all without crafting a single query!

Access to Logs Explore is available both as a standalone feature or integrated within Dashboards.

<img src="imgs/service_index.png" alt="app"/>

## Installation in Your Own Grafana Instance

You can install the app in your own Grafana instance using `grafana-cli`:

```sh
grafana-cli --pluginUrl=https://storage.googleapis.com/grafana-lokiexplore-app/grafana-lokiexplore-app-latest.zip plugins install grafana-lokiexplore-app
```

## Test Out with Docker Compose

Test out the app using the following command to spin up Grafana, Loki, and the Logs Explore App:

```sh
  docker-compose up
```

## Getting Started

1. Click on Explore > Logs in the main navigation bar.
2. You’ll land on a service overview page that shows time series and log visualizations for all the services in your selected Loki instance.
3. You can change your data source with the drop-down on the top left.
4. You can modify your time range in two ways:
   - With the standard time range picker on the top right.
   - By dragging and dropping the time range you want to see on any time series visualization.
5. Services are shown based on the volume of logs, and you can search for the service you want through the Search service input.
6. Select the service you would like to explore. This takes you to the Service page.
7. Filter logs based on strings, labels, detected fields, or detected patterns.

<img src="imgs/service_logs.png" alt="app"/>

## Community Resources, Feedback, and Support

- Found a bug? Want a new feature? Feel free to open an [issue](https://github.com/grafana/loki-explore/issues/new).
- Have a question? You can also open an issue, but for questions, it would be better to use the [Grafana Community](https://community.grafana.com/) portal.
- Have feedback? Please contact us through the [Grafana Logs Feedback](https://docs.google.com/forms/d/e/1FAIpQLSdcnzb0QYBqzp3RkrXIxqYKzDdw8gf0feZkOu4eZSIPyTUY1w/viewform) form.