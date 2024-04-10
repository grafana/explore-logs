import { CustomTableFieldOptions, CustomTableOptions, CustomTablePanel } from '../panels/tablePanel';
import { PanelPlugin } from '@grafana/data';

export const customTablePanel = new PanelPlugin<CustomTableOptions, CustomTableFieldOptions>(
  CustomTablePanel
).useFieldConfig({
  useCustomConfig: (builder) => {
    builder.addNumberInput({
      path: 'numericOption',
      name: 'Numeric option',
      description: 'A numeric option',
      defaultValue: 1,
    });
  },
});
// @todo where is a good place to register stuff?
// sceneUtils.registerRuntimePanelPlugin({ pluginId: 'custom-table-viz', plugin: customTablePanel });
