import React from 'react';
import { Redirect, Route, Switch } from 'react-router-dom';
import { prefixRoute } from '../../utils/utils.routing';
import { ROUTES } from '../../constants';
import { LogExplorationPage } from '../../pages/Explore';
// @ts-ignore
import { contextSrv } from 'grafana/app/core/core';

export const Routes = () => {
  const routes = [];
  if (contextSrv.hasPermission('grafana-lokiexplore-app:read')) {
    routes.push(<Route path={prefixRoute(ROUTES.Explore)} component={LogExplorationPage} />);
    routes.push(<Redirect to={prefixRoute(ROUTES.Explore)} />);
  }

  return (
    <Switch>
      {routes}
    </Switch>
  );
};
