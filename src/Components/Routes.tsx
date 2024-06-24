import React from 'react';
import { Redirect, Route, Switch } from 'react-router-dom';
import { config } from '@grafana/runtime';
import { prefixRoute, ROUTES } from 'services/routing';
import { LogExplorationView } from './LogExplorationPage';

// @todo remove
export const Routes = () => {
  const userPermissions = config.bootData.user.permissions;
  const canUseApp = userPermissions?.['grafana-lokiexplore-app:read'] || userPermissions?.['datasources:explore'];
  if (!canUseApp) {
    return <Redirect to="/" />;
  }

  console.log('route render');

  return (
    <Switch>
      <Route path={prefixRoute(ROUTES.Explore)} component={LogExplorationView} />
      <Redirect to={prefixRoute(ROUTES.Explore)} />
    </Switch>
  );
};
