import { Alert } from '@grafana/ui';
import React from 'react';

export function InterceptBanner(props: { interceptDismissed: boolean; onRemove: () => void }) {
  return (
    <>
      {!props.interceptDismissed && (
        <Alert
          severity={'info'}
          title={"Welcome to Explore Logs (preview) - we're in active development so please expect things to change."}
          onRemove={props.onRemove}
        >
          <div>
            Check out our{' '}
            <a className="external-link" href="#">
              video
            </a>
            , dive into our{' '}
            <a className="external-link" href="#">
              Get started doc
            </a>
            , or see{' '}
            <a className={'external-link'} href="https://github.com/grafana/explore-logs/releases">
              recent changes
            </a>
            .<br />
            Help us shape the future of the app.{' '}
            <a className={'external-link'} href="https://forms.gle/1sYWCTPvD72T1dPH9">
              Send us feedback
            </a>{' '}
            or engage with us on{' '}
            <a
              className={'external-link'}
              href="https://github.com/grafana/explore-logs/?tab=readme-ov-file#explore-logs"
            >
              GitHub
            </a>
            .
          </div>
        </Alert>
      )}
    </>
  );
}
