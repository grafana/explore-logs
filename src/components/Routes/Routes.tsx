import React from 'react';
import { Redirect, Route, Switch } from 'react-router-dom';
import { prefixRoute } from '../../utils/utils.routing';
import { ROUTES } from '../../constants';
import { LogExplorationPage } from '../../pages/Explore';
import { config } from '@grafana/runtime';

export const Routes = () => {
  const userPermissions = config.bootData.user.permissions;
  const canUseApp = userPermissions?.['grafana-lokiexplore-app:read'] === true;
  if (!canUseApp) {
    return null;
  }

  return (
    <Switch>
      <Route path={prefixRoute(ROUTES.Explore)} component={LogExplorationPage} />
      <Redirect to={prefixRoute(ROUTES.Explore)} />
    </Switch>
  );
};
