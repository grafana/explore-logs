import React from 'react';
import { Redirect, Route, Switch } from 'react-router-dom';
import { prefixRoute } from '../../utils/utils.routing';
import { ROUTES } from '../../constants';
import { LogExplorationPage } from '../../pages/Explore';

export const Routes = () => {
  return (
    <Switch>
      <Route path={prefixRoute(`${ROUTES.Explore}`)} component={LogExplorationPage} />
      <Redirect to={prefixRoute(ROUTES.Explore)} />
    </Switch>
  );
};
