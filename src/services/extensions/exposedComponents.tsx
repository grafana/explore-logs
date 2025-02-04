import { LinkButton } from '@grafana/ui';
import { OpenInExploreLogsButtonProps } from 'Components/OpenInExploreLogsButton';
import React, { lazy, Suspense } from 'react';
const EntityAssertionsWidget = lazy(() => import('Components/OpenInExploreLogsButton'));

function SuspendedOpenInExploreLogsButton(props: OpenInExploreLogsButtonProps) {
  return (
    <Suspense
      fallback={
        <LinkButton variant="secondary" disabled>
          Open in Explore logs
        </LinkButton>
      }
    >
      <EntityAssertionsWidget {...props} />
    </Suspense>
  );
}

export const exposedComponents = [
  {
    id: `grafana-lokiexplore-app/open-in-explore-logs-button/v1`,
    title: 'Open in Explore logs button',
    description: 'A button that opens a logs view in the Explore logs app.',
    component: SuspendedOpenInExploreLogsButton,
  },
];
