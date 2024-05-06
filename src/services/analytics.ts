import { reportInteraction } from '@grafana/runtime';
import pluginJson from '../plugin.json';

// Helper function to create a unique interaction name for analytics
const createInteractionName = (page: 'service_selection' | 'service_details', action: string) => {
  return `grafana_${pluginJson.id}_${page}_${action}`;
};

// Runs reportInteraction with a standardized interaction name
export const reportAppInteraction = (
  page: 'service_selection' | 'service_details',
  action: string,
  properties?: Record<string, unknown>
) => {
  reportInteraction(createInteractionName(page, action), properties);
};
