import React from 'react';
import { AppRootProps } from '@grafana/data';
import { Routes } from 'Routes';

export class App extends React.PureComponent<AppRootProps> {
  render() {
    return <Routes />;
  }
}
