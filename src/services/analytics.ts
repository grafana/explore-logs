import { reportInteraction } from '@grafana/runtime';
import pluginJson from '../plugin.json';

// Helper function to create a unique interaction name for analytics
const createInteractionName = (page: UserEventPagesType, action: string) => {
  return `${pluginJson.id.replace(/-/g, '_')}_${page}_${action}`;
};

// Runs reportInteraction with a standardized interaction name
export const reportAppInteraction = (
  page: UserEventPagesType,
  action: UserEventActionType,
  properties?: Record<string, unknown>
) => {
  reportInteraction(createInteractionName(page, action), properties);
};

export const USER_EVENTS_PAGES = {
  service_selection: 'service_selection',
  service_details: 'service_details',
  all: 'all',
} as const;

type UserEventPagesType = keyof typeof USER_EVENTS_PAGES;
type UserEventActionType =
  | keyof (typeof USER_EVENTS_ACTIONS)['service_selection']
  | keyof (typeof USER_EVENTS_ACTIONS)['service_details']
  | keyof (typeof USER_EVENTS_ACTIONS)['all'];

export const USER_EVENTS_ACTIONS = {
  [USER_EVENTS_PAGES.service_selection]: {
    // Searching for service using search input. Props: searchQueryLength, containsLevel
    search_services_changed: 'search_services_changed',
    // Selecting service. Props: service
    service_selected: 'service_selected',
    // Toggling aggregated metrics on/off
    aggregated_metrics_toggled: 'aggregated_metrics_toggled',
    add_to_filters: 'add_to_filters',
  },
  [USER_EVENTS_PAGES.service_details]: {
    open_in_explore_clicked: 'open_in_explore_clicked',
    // Selecting action view tab (logs/labels/fields/patterns). Props: newActionView, previousActionView
    action_view_changed: 'action_view_changed',
    // Clicking on "Include" button in time series panels. Used in multiple views. The view type is passed as a parameter. Props: filterType, key, isFilterDuplicate, filtersLength
    add_to_filters_in_breakdown_clicked: 'add_to_filters_in_breakdown_clicked',
    // Clicking on "Select" button button in time series panels. Used in multiple views.The view type is passed as a parameter. Props: field, previousField, view
    select_field_in_breakdown_clicked: 'select_field_in_breakdown_clicked',
    // Clicking on one of the levels in the Logs Volume panel
    level_in_logs_volume_clicked: 'level_in_logs_volume_clicked',
    label_in_panel_summary_clicked: 'label_in_panel_summary_clicked',
    // Changing layout type (e.g. single/grid/rows). Used in multiple views. The view type is passed as a parameter. Props: layout, view
    layout_type_changed: 'layout_type_changed',
    // Changing search string in logs. Props: searchQuery
    search_string_in_logs_changed: 'search_string_in_logs_changed',
    search_string_in_variables_changed: 'search_string_in_variables_changed',
    // Removing a pattern (e.g. include/exclude) from the list. Props: includePatternsLength, excludePatternsLength, type
    pattern_removed: 'pattern_removed',
    // Selecting a pattern (e.g. include/exclude) from the list. Props: includePatternsLength, excludePatternsLength, type
    pattern_selected: 'pattern_selected',
    // Clicking on a pattern field in the pattern name.
    pattern_field_clicked: 'pattern_field_clicked',
    // Toggling between logs/table view
    logs_visualization_toggle: 'logs_visualization_toggle',
    // Filter (include, exclude) from log details
    logs_detail_filter_applied: 'logs_detail_filter_applied',
    // Popover menu filter
    logs_popover_line_filter: 'logs_popover_line_filter',
    // Toggle displayed fields
    logs_toggle_displayed_field: 'logs_toggle_displayed_field',
    // Clear all displayed fields
    logs_clear_displayed_fields: 'logs_clear_displayed_fields',
    // Value breakdown sort change
    value_breakdown_sort_change: 'value_breakdown_sort_change',
    // Wasm not supported
    wasm_not_supported: 'wasm_not_supported',
    change_viz_type: 'change_viz_type',
  },
  [USER_EVENTS_PAGES.all]: {
    interval_too_long: 'interval_too_long',
    open_in_explore_menu_clicked: 'open_in_explore_menu_clicked',
  },
} as const;
