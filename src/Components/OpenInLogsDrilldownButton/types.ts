import { AbstractLabelMatcher } from '@grafana/data';

export interface OpenInLogsDrilldownButtonProps {
  datasourceUid?: string;
  streamSelectors: AbstractLabelMatcher[];
  from?: string;
  to?: string;
  returnToPreviousSource?: string;
  renderButton?: (props: { href: string }) => React.ReactElement<any>;
}
