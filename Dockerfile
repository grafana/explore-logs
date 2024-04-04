FROM grafana/grafana-dev:11.0.0-164675

RUN <<EOF cat >> /etc/grafana/provisioning/datasources/loki.yaml
apiVersion: 1
datasources:
  - name: gdev-loki
    type: loki
    uid: gdev-loki
    access: proxy
    url: http://127.0.0.1:3100
EOF

RUN <<EOF cat >> /etc/grafana/provisioning/plugins/loki.yaml
apiVersion: 1
apps:
  - type: grafana-explorelogs-app
    org_id: 1
    org_name: Grafana
    disabled: false
    jsonData:
      apiUrl: http://default-url.com
      isApiKeySet: true
    secureJsonData:
      apiKey: secret-key
EOF

ENV GF_AUTH_ANONYMOUS_ORG_ROLE "Admin"
ENV GF_AUTH_ANONYMOUS_ENABLED "true"
ENV GF_AUTH_BASIC_ENABLED "false"
ENV GF_DEFAULT_APP_MODE "development"

EXPOSE 3000

COPY ./dist /var/lib/grafana/plugins/grafana-logsapp
