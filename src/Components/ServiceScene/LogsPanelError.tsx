import React from 'react';
import { GrotError } from 'Components/GrotError';
import { Button } from '@grafana/ui';

interface Props {
  clearFilters(): void;
  error: string;
}

export const LogsPanelError = ({ clearFilters, error }: Props) => {
  return (
    <GrotError>
      <div>
        <p>
          <strong>No logs found.</strong>
        </p>
        <p>{getMessageFromError(error)}</p>
        <Button variant="secondary" onClick={clearFilters}>
          Clear filters
        </Button>
      </div>
    </GrotError>
  );
};

function getMessageFromError(error: string) {
  if (error.includes('parse error')) {
    return 'Logs could not be retrieved due to invalid filter parameters. Please review your filters and try again.';
  }

  return 'Logs could not be retrieved. Please review your filters or try a different time interval.';
}
