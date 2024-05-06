import { reportInteraction } from '@grafana/runtime';
import pluginJson from '../plugin.json';

// Helper function to create a unique interaction name for analytics
const createInteractionName = (page: string, action: string) => {
  return `grafana_${pluginJson.id}_${page}_${action}`;
};

// Runs reportInteraction with a standardized interaction name
export const reportAppInteraction = (page: string, action: string, properties?: Record<string, unknown>) => {
  reportInteraction(createInteractionName(page, action), properties);
};

export const USER_EVENTS = {
  pages: {
    service_selection: 'service_selection',
    service_details: 'service_details',
  },
  // Actions per page
  actions: {
    service_selection: {
      // Updating input field in search bar
      search_services_changed: 'search_services_changed',
      // Selecting a service from the list
      service_selected: 'service_selected',
    },
    service_details: {
      open_in_explore_clicked: 'open_in_explore_clicked',
      share_exploration_clicked: 'share_exploration_clicked',
      // Selecting action view tab (logs/labels/fields/patterns)
      action_view_changed: 'action_view_changed',
      // Clicking on "Add to filters" button in time series panels. Used in multiple views. The view type is passed as a parameter.
      add_to_filters_in_breakdown_clicked: 'add_to_filters_in_breakdown_clicked',
      // Clicking on "Select" button button in time series panels. Used in multiple views.The view type is passed as a parameter.
      select_field_in_breakdown_clicked: 'select_field_in_breakdown_clicked',
      // Changing layout type (e.g. single/grid/rows). Used in multiple views. The view type is passed as a parameter.
      layout_type_changed: 'layout_type_changed',
      // Changing search string in logs
      search_string_in_logs_changed: 'search_string_changed',
      // Removing pattern from selected pattern list
      pattern_removed: 'pattern_removed',
      // Selecting a pattern (e.g. include/exclude) from the list
      pattern_selected: 'pattern_selected',
    },
  },
};
