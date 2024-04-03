import React from 'react';
import { Redirect, Route, Switch } from 'react-router-dom';
import { prefixRoute } from '../../utils/utils.routing';
import { ROUTES } from '../../constants';
import { LogExplorationPage } from '../../pages/Explore';
import { config } from '@grafana/runtime';

export const Routes = () => {
  const userPermissions = config.bootData.user.permissions;
  const canUseApp = userPermissions?.['grafana-lokiexplore-app:read'] === true;
  const routes = [];
  if (canUseApp) {
    routes.push(<Route path={prefixRoute(ROUTES.Explore)} component={LogExplorationPage} />);
    routes.push(<Redirect to={prefixRoute(ROUTES.Explore)} />);
  }

  return (
    <Switch>
      {routes}
    </Switch>
  );
};
