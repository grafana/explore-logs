import { Alert } from '@grafana/ui';
import React from 'react';

export function InterceptBanner(props: { interceptDismissed: boolean; onRemove: () => void }) {
  return (
    <>
      {!props.interceptDismissed && (
        <Alert
          severity={'info'}
          title={'Explore logs is under active development in a preview state.'}
          onRemove={props.onRemove}
        >
          <div>
            Watch this{' '}
            <a className="external-link" href="#">
              quick video
            </a>{' '}
            to learn how Explore Logs can help investigate your Loki logs without writing a single query!
          </div>
          <br />

          <div>
            We&rsquo;re looking for help in shaping the future of Logs Explore. If you have any suggestions or issues,
            please let us know on{' '}
            <a className="external-link" href="https://github.com/grafana/explore-logs/issues/new">
              GitHub
            </a>
            .
          </div>

          <div>
            Check out the{' '}
            <a
              href="https://github.com/grafana/explore-logs?tab=readme-ov-file#explore-logs"
              className="external-link"
              target="_blank"
              rel="noreferrer"
            >
              docs
            </a>{' '}
            or{' '}
            <a
              href="https://github.com/grafana/explore-logs/releases"
              className="external-link"
              target="_blank"
              rel="noreferrer"
            >
              recent changes
            </a>{' '}
            to learn more.
          </div>
        </Alert>
      )}
    </>
  );
}
