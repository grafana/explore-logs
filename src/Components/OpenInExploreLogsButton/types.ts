export interface OpenInExploreLogsButtonProps {
  datasourceUid?: string;
  labelMatchers: Array<{ name: string; value: string }>;
  from?: string;
  to?: string;
  returnToPreviousSource?: string;
  renderButton?: (props: { href: string }) => React.ReactElement<any>;
}
