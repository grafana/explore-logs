import { Alert } from '@grafana/ui';
import React from 'react';

export function InterceptBanner(props: { onRemove: () => void }) {
  return (
    <>
      <Alert severity={'info'} title={'Welcome to Explore Logs!'} onRemove={props.onRemove}>
        <div>
          Check out our{' '}
          <a
            className="external-link"
            target="_blank"
            href="https://grafana.com/docs/grafana-cloud/visualizations/simplified-exploration/logs/"
            rel="noreferrer"
          >
            Get started doc
          </a>
          , or see{' '}
          <a
            className="external-link"
            target="_blank"
            href="https://github.com/grafana/explore-logs/releases"
            rel="noreferrer"
          >
            recent changes
          </a>
          .<br />
          Help us shape the future of the app.{' '}
          <a className="external-link" target="_blank" href="https://forms.gle/1sYWCTPvD72T1dPH9" rel="noreferrer">
            Send us feedback
          </a>{' '}
          or engage with us on{' '}
          <a
            className="external-link"
            target="_blank"
            href="https://github.com/grafana/explore-logs/?tab=readme-ov-file#explore-logs"
            rel="noreferrer"
          >
            GitHub
          </a>
          .
        </div>
      </Alert>
    </>
  );
}
