# Grafana Logs Drilldown Documentation

This directory contains the source code for the Grafana Logs Drilldown documentation.

Some key things to know about the Grafana Logs Drilldown documentation source:

- The docs are written in markdown, specifically the CommonMark flavor of markdown.
- The Grafana docs team uses [Hugo](https://gohugo.io/) to generate the documentation.
- While you can view the documentation in GitHub, GitHub does not render the images or links correctly and cannot render the Hugo specific shortcodes.

The docs team has created a [Writers' Toolkit](https://grafana.com/docs/writers-toolkit/) that documents how we write documentation at Grafana Labs. Writers' Toolkit contains information about how we structure documentation at Grafana, including [templates](https://github.com/grafana/writers-toolkit/tree/main/docs/static/templates) for different types of topics, information about Hugo shortcodes that extend markdown to add additional features, and information about linters and other tools that we use to write documentation. Writers' Toolkit also includes our [Style Guide](https://grafana.com/docs/writers-toolkit/write/style-guide/).

## Contributing

The Grafana Logs Drilldown documentation is written using the CommonMark flavor of markdown, including some extended features. For more information about markdown, you can see the [CommonMark specification](https://spec.commonmark.org/), and a [quick reference guide](https://commonmark.org/help/) for CommonMark.

If you have a GitHub account and you're just making a small fix, for example fixing a typo or updating an example, you can edit the topic in GitHub.

1. Find the topic in the Grafana Logs Drilldown repo.
2. Click the pencil icon.
3. Enter your changes.
4. Click **Commit changes**. GitHub creates a pull request for you.
5. If this is your first contribution to the Grafana Logs Drilldown repository, you will need to sign the Contributor License Agreement (CLA) before your PR can be accepted.

Note that in Hugo the structure of the documentation is based on the folder structure of the documentation repository. The URL structure is generated based on the folder structure and file names.
