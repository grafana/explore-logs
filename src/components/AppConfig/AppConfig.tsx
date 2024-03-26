import React from 'react';

import { AppPluginMeta, PluginConfigPageProps, PluginMeta } from '@grafana/data';
import {FetchResponse, getBackendSrv, locationService} from '@grafana/runtime';
import { Button, FieldSet } from '@grafana/ui';
import { Observable, lastValueFrom } from 'rxjs';

export type JsonData = {
};

interface Props extends PluginConfigPageProps<AppPluginMeta<JsonData>> {}

export const AppConfig = ({ plugin }: Props) => {
  const { enabled, jsonData } = plugin.meta;

  return (
    <div>
      {/* ENABLE / DISABLE PLUGIN */}
      <FieldSet label="Enable / Disable">
        {!enabled && (
          <>
            <div>The plugin is currently not enabled.</div>
            <Button
              variant="primary"
              onClick={() =>
                updatePluginAndReload(plugin.meta.id, {
                  enabled: true,
                  pinned: true,
                  jsonData,
                })
              }
            >
              Enable plugin
            </Button>
          </>
        )}

        {/* Disable the plugin */}
        {enabled && (
          <>
            <div>The plugin is currently enabled.</div>
            <Button
              variant="destructive"
              onClick={() =>
                updatePluginAndReload(plugin.meta.id, {
                  enabled: false,
                  pinned: false,
                  jsonData,
                })
              }
            >
              Disable plugin
            </Button>
          </>
        )}
      </FieldSet>
    </div>
  );
};

const updatePluginAndReload = async (pluginId: string, data: Partial<PluginMeta<JsonData>>) => {
  try {
    await updatePlugin(pluginId, data);

    // Reloading the page as the changes made here wouldn't be propagated to the actual plugin otherwise.
    // This is not ideal, however unfortunately currently there is no supported way for updating the plugin state.
    locationService.reload();
  } catch (e) {
    console.error('Error while updating the plugin', e);
  }
};

export const updatePlugin = async (pluginId: string, data: Partial<PluginMeta>) => {
  const response = getBackendSrv().fetch({
    url: `/api/plugins/${pluginId}/settings`,
    method: 'POST',
    data,
  }) as unknown as Observable<FetchResponse>;

  const dataResponse = await lastValueFrom(response);

  return dataResponse.data;
};
