import { sceneGraph, SceneObjectState, SceneObjectBase, SceneComponentProps } from '@grafana/scenes';
import React, { useEffect } from 'react';

interface CustomObjectState extends SceneObjectState {}

export class CustomObject extends SceneObjectBase<CustomObjectState> {
  static Component = CustomObjectRenderer;
}

function CustomObjectRenderer({ model }: SceneComponentProps<CustomObject>) {
  console.log('model', model);
  const data = sceneGraph.getData(model).useState();

  useEffect(() => {
    console.log('dataModel changed', data);
  }, [data]);

  return <div>Hello custom component</div>;
}
