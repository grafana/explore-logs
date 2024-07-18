import { GrotError } from '../../../GrotError';
import { TextLink } from '@grafana/ui';
import React from 'react';

export function PatternsNotDetected() {
  return (
    <GrotError>
      <div>
        <p>
          <strong>Sorry, we could not detect any patterns.</strong>
        </p>
        <p>
          Check back later or reach out to the team in the{' '}
          <TextLink href="https://slack.grafana.com/" external>
            Grafana Labs community Slack channel
          </TextLink>
        </p>
        <p>Patterns let you detect similar log lines to include or exclude from your search.</p>
      </div>
    </GrotError>
  );
}

export function PatternsTooOld() {
  return (
    <GrotError>
      <div>
        <p>
          <strong>Patterns are only available for the most recent 3 hours of data.</strong>
        </p>
        <p>
          See the{' '}
          <TextLink
            href="https://grafana.com/docs/grafana/latest/explore/simplified-exploration/logs/patterns/"
            external
          >
            patterns docs
          </TextLink>{' '}
          for more info.
        </p>
      </div>
    </GrotError>
  );
}
