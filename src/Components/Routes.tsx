import React from 'react';
import { Redirect, Route, Switch } from 'react-router-dom';
import { config } from '@grafana/runtime';
import { LogExplorationPage } from 'Components/Pages/Explore/LogExplorationPage';
import { ROUTES, prefixRoute } from 'services/routing';

export const Routes = () => {
  const userPermissions = config.bootData.user.permissions;
  const canUseApp = userPermissions?.['grafana-lokiexplore-app:read'] || userPermissions?.['datasources:explore'];
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
