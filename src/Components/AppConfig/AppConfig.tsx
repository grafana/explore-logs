import { getBackendSrv, locationService } from '@grafana/runtime';
import { AppPluginMeta, GrafanaTheme2, PluginConfigPageProps, PluginMeta, rangeUtil } from '@grafana/data';
import { lastValueFrom } from 'rxjs';
import { css } from '@emotion/css';
import { Button, Field, FieldSet, Icon, Input, Tooltip, useStyles2 } from '@grafana/ui';
import React, { ChangeEvent, useState } from 'react';
import { isNumber } from 'lodash';
import { logger } from '../../services/logger';

export type JsonData = {
  interval?: string;
};

type State = {
  interval: string;
  isValid: boolean;
};

// 1 hour minimum
const MIN_INTERVAL_SECONDS = 3600;

interface Props extends PluginConfigPageProps<AppPluginMeta<JsonData>> {}

const AppConfig = ({ plugin }: Props) => {
  const s = useStyles2(getStyles);
  const { enabled, pinned, jsonData } = plugin.meta;

  const [state, setState] = useState<State>({
    interval: jsonData?.interval || '',
    isValid: isValid(jsonData?.interval ?? ''),
  });

  const onChangeInterval = (event: ChangeEvent<HTMLInputElement>) => {
    const interval = event.target.value.trim();
    setState({
      ...state,
      interval,
      isValid: isValid(interval),
    });
  };

  return (
    <div data-testid={testIds.appConfig.container}>
      {/* CUSTOM SETTINGS */}
      <FieldSet label="Settings" className={s.marginTopXl}>
        {/* interval */}
        <Field
          label={
            <span className={s.label}>
              Max interval{' '}
              <Tooltip
                content={
                  'The maximum interval that can be selected in the time picker within the Explore Logs app. e.g. 7d, 24h, 24hours Unused if empty.'
                }
              >
                <Icon className={s.icon} name={'question-circle'} />
              </Tooltip>
            </span>
          }
          description=""
          className={s.marginTop}
        >
          <Input
            width={60}
            id="interval"
            data-testid={testIds.appConfig.interval}
            label={`Max interval`}
            value={state?.interval}
            placeholder={`e.g.: 7d`}
            onChange={onChangeInterval}
          />
        </Field>

        <div className={s.marginTop}>
          <Button
            type="submit"
            data-testid={testIds.appConfig.submit}
            onClick={() =>
              updatePluginAndReload(plugin.meta.id, {
                enabled,
                pinned,
                jsonData: {
                  interval: state.interval,
                },
              })
            }
            disabled={!isValid(state.interval)}
          >
            Save settings
          </Button>
        </div>
      </FieldSet>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  colorWeak: css`
    color: ${theme.colors.text.secondary};
  `,
  marginTop: css`
    margin-top: ${theme.spacing(3)};
  `,
  marginTopXl: css`
    margin-top: ${theme.spacing(6)};
  `,
  label: css({
    display: 'flex',
    alignItems: 'center',
    marginBottom: theme.spacing(0.75),
  }),
  icon: css({
    marginLeft: theme.spacing(1),
  }),
});

const updatePluginAndReload = async (pluginId: string, data: Partial<PluginMeta<JsonData>>) => {
  try {
    await updatePlugin(pluginId, data);

    // Reloading the page as the changes made here wouldn't be propagated to the actual plugin otherwise.
    // This is not ideal, however unfortunately currently there is no supported way for updating the plugin state.
    locationService.reload();
  } catch (e) {
    logger.error('Error while updating the plugin');
  }
};

const testIds = {
  appConfig: {
    container: 'data-testid ac-container',
    interval: 'data-testid ac-interval-input',
    submit: 'data-testid ac-submit-form',
  },
};

export const updatePlugin = async (pluginId: string, data: Partial<PluginMeta>) => {
  const response = getBackendSrv().fetch({
    url: `/api/plugins/${pluginId}/settings`,
    method: 'POST',
    data,
  });

  const dataResponse = await lastValueFrom(response);

  return dataResponse.data;
};

const isValid = (interval: string): boolean => {
  try {
    if (interval) {
      const seconds = rangeUtil.intervalToSeconds(interval);
      return isNumber(seconds) && seconds >= MIN_INTERVAL_SECONDS;
    } else {
      // Empty strings are fine
      return true;
    }
  } catch (e) {}

  return false;
};

export default AppConfig;
