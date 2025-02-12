import { LinkButton } from '@grafana/ui';
import { OpenInExploreLogsButtonProps } from 'Components/OpenInExploreLogsButton/types';
import React, { lazy, Suspense } from 'react';
const OpenInExploreLogsButton = lazy(() => import('Components/OpenInExploreLogsButton/OpenInExploreLogsButton'));

function SuspendedOpenInExploreLogsButton(props: OpenInExploreLogsButtonProps) {
  return (
    <Suspense
      fallback={
        <LinkButton variant="secondary" disabled>
          Open in Explore Logs
        </LinkButton>
      }
    >
      <OpenInExploreLogsButton {...props} />
    </Suspense>
  );
}

export const exposedComponents = [
  {
    id: `grafana-lokiexplore-app/open-in-explore-logs-button/v1`,
    title: 'Open in Explore Logs button',
    description: 'A button that opens a logs view in the Explore Logs app.',
    component: SuspendedOpenInExploreLogsButton,
  },
];
