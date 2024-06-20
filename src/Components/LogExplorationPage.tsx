import React, {useEffect} from 'react';

import {EmbeddedScene, getUrlSyncManager, SceneApp, SceneAppPage, SceneTimeRange, useSceneApp} from '@grafana/scenes';
import {IndexScene} from './IndexScene/IndexScene';
import {EXPLORATIONS_ROUTE, prefixRoute, ROUTES} from "../services/routing";
import {PageLayoutType} from "@grafana/data";
import {buildLogsListScene} from "./ServiceScene/LogsListScene";

const DEFAULT_TIME_RANGE = {from: 'now-15m', to: 'now'};

export function LogExplorationView() {
    const [isInitialized, setIsInitialized] = React.useState(false);

    const scene = useSceneApp(() => {
        return new SceneApp({

            pages: [new SceneAppPage({
                title: 'Service index',
                url: EXPLORATIONS_ROUTE,
                layout: PageLayoutType.Custom,
                // tabs: [
                //     new SceneAppPage({
                //         url: prefixRoute(ROUTES.Logs),
                //         layout: PageLayoutType.Custom,
                //         title: 'Service index',
                //         getScene: () => buildLogsListScene(),
                //     })
                // ],

                getScene: () => {
                    return new EmbeddedScene({
                        body: new IndexScene({
                            $timeRange: new SceneTimeRange(DEFAULT_TIME_RANGE),
                        })
                    })
                }
            })]
        })
    })

    useEffect(() => {
        if (!isInitialized) {
            getUrlSyncManager().initSync(scene);
            setIsInitialized(true);

        }
    }, [scene, isInitialized]);

    if (!isInitialized) {
        return null;
    }

    return <scene.Component model={scene}/>;
}
