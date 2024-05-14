import React from 'react';
import { GrotError } from 'Components/GrotError';
import { TextLink, Text } from '@grafana/ui';

export const ConfigureVolumeError = () => {
  return (
    <GrotError>
      <p>Log volume has not been configured.</p>
      <p>
        <TextLink href="https://grafana.com/docs/loki/latest/reference/api/#query-log-volume" external>
          Instructions to enable volume in the Loki config:
        </TextLink>
      </p>
      <Text textAlignment="left">
        <pre>
          <code>
            limits_config:
            <br />
            &nbsp;&nbsp;volume_enabled: true
          </code>
        </pre>
      </Text>
    </GrotError>
  );
};
