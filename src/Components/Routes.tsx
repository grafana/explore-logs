import React from 'react';
import { Redirect, Route, Switch } from 'react-router-dom';
import { config } from '@grafana/runtime';
import { prefixRoute, ROUTES } from 'services/routing';
import { LogExplorationView } from './LogExplorationPage';

export const Routes = () => {
  const userPermissions = config.bootData.user.permissions;
  const canUseApp = userPermissions?.['grafana-lokiexplore-app:read'] || userPermissions?.['datasources:explore'];
  if (!canUseApp) {
    return <Redirect to="/" />;
  }

  return (
    <Switch>
      <Route path={prefixRoute(ROUTES.Explore)} component={LogExplorationView} />
      <Redirect to={prefixRoute(ROUTES.Explore)} />
    </Switch>
  );
};
