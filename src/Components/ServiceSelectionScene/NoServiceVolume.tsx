import React from 'react';
import { GrotError } from 'Components/GrotError';

export const NoServiceVolume = (props: { labelName: string }) => {
  return (
    <GrotError>
      <p>
        No logs found in <strong>{props.labelName}</strong>.<br />
        Please adjust time range or select another label.
      </p>
    </GrotError>
  );
};
