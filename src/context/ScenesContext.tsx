import React, { createContext, ReactNode, useEffect, useState } from 'react';
import { SceneObjectState } from '@grafana/scenes';

interface ScenesContextType {
  sceneObject: any;
  updateSceneObject: (update: Partial<SceneObjectState>) => void;
}

export const ScenesContext = createContext<ScenesContextType | undefined>(undefined);

export const ScenesContextProvider = ({ children, sceneObject }: { children: ReactNode; sceneObject: any }) => {
  const [state, setState] = useState<SceneObjectState>(sceneObject.state);

  const updateSceneObject = (update: Partial<SceneObjectState>) => {
    sceneObject.setState(update);
  };

  useEffect(() => {
    const subscription = sceneObject.subscribeToState((newState: any, prevState: any) => {
      setState({ ...newState });
    });

    return () => {
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneObject, state]);

  return <ScenesContext.Provider value={{ sceneObject: state, updateSceneObject }}>{children}</ScenesContext.Provider>;
};
