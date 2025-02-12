import { AbstractLabelMatcher } from '@grafana/data';

export interface OpenInExploreLogsButtonProps {
  datasourceUid?: string;
  labelMatchers: AbstractLabelMatcher[];
  from?: string;
  to?: string;
  returnToPreviousSource?: string;
  renderButton?: (props: { href: string }) => React.ReactElement<any>;
}
