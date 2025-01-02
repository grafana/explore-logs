import {SceneComponentProps, SceneDataState, sceneGraph, SceneObjectBase, SceneObjectState} from "@grafana/scenes";
import React from "react";
import {JSONTree} from "react-json-tree";
import {getLogsPanelFrame} from "./ServiceScene";
import {dateTimeFormat, FieldType, getTimeZone, GrafanaTheme2, LoadingState, PanelData} from "@grafana/data";
import {PanelChrome} from "@grafana/ui";
import {LogsPanelHeaderActions} from "../Table/LogsHeaderActions";
import {PanelMenu} from "../Panels/PanelMenu";
import {LogsListScene} from "./LogsListScene";
import {css} from "@emotion/css";

interface LogsJsonSceneState extends SceneObjectState {
    menu?: PanelMenu;
    data?: PanelData
}

export class LogsJsonScene extends SceneObjectBase<LogsJsonSceneState> {

    constructor(state: Partial<LogsJsonSceneState>) {
        super(state);

        this.addActivationHandler(this.onActivate.bind(this));
    }

    public static Component = ({model}: SceneComponentProps<LogsJsonScene>) => {
        // const styles = useStyles2(getStyles);
        const {menu, data} = model.useState();
        const parentModel = sceneGraph.getAncestor(model, LogsListScene);
        const {visualizationType} = parentModel.useState();

        const dataFrame = getLogsPanelFrame(data);
        const lineField = dataFrame?.fields.find(field => field.type === FieldType.string && (field.name === 'Line' || field.name === 'body'))

        return (
            <PanelChrome
                loadingState={data?.state}
                title={'Logs'}
                menu={menu ? <menu.Component model={menu}/> : undefined}
                actions={
                    <LogsPanelHeaderActions
                        vizType={visualizationType}
                        onChange={parentModel.setVisualizationType}/>
                }>
                {/*<JSONTree data={dataFrame} shouldExpandNodeInitially={(keyPath, data, level) => level <= 1} />*/}
                <JSONTree data={lineField?.values} shouldExpandNodeInitially={(keyPath, data, level) => level <= 1} />

            </PanelChrome>
        )
    }

    public onActivate() {
        this.setState({
            menu: new PanelMenu({addExplorationsLink: false}),
        });

        const $data = sceneGraph.getData(this)
        console.log('broken sub?', $data)
        if($data.state.data?.state === LoadingState.Done){
            this.updateJsonFrame($data.state);
        }

        $data.subscribeToState(newState => {
            if (newState.data?.state === LoadingState.Done) {
                this.updateJsonFrame(newState);
            }
        })
    }

    private updateJsonFrame(newState: SceneDataState) {
        const dataFrame = getLogsPanelFrame(newState.data);
        const time = dataFrame?.fields.find(field => field.type === FieldType.time)
        const timeNs = dataFrame?.fields.find(field => field.type === FieldType.string && field.name === 'tsNs')
        const labels = dataFrame?.fields.find(field => field.type === FieldType.other && field.name === 'labels')

        const timeZone = getTimeZone();
        if(newState.data){
            console.time('json parse')
            const transformedData: PanelData = {
                ...newState.data,
                series: newState.data.series.map(frame => {
                    return {
                        ...frame, fields: frame.fields.map(f => {
                            if (f.name === 'Line') {
                                return {
                                    ...f, values: f.values.map((v, i) => {
                                        let parsed;
                                        try {
                                            parsed = JSON.parse(v)
                                        } catch (e) {
                                            parsed = v;
                                        }
                                        return {
                                            // @todo ns?
                                            Time: renderTimeStamp(time?.values?.[i], parseInt(timeNs?.values[i], 10) - time?.values?.[i] * 1000000, timeZone),
                                            Line: parsed,
                                            // @todo labels? Allow filtering when key has same name as label?
                                            // Labels: labels?.values[i],
                                        }
                                        // return parsed;
                                    })
                                }
                            }
                            return f
                        })
                    }
                })
            };
            console.timeEnd('json parse')
            this.setState({
                data: transformedData
            })
        }

    }
}

const renderTimeStamp = (epochMs: number, nanos?: number, timeZone?: string) => {
    return dateTimeFormat(epochMs, {
        timeZone: timeZone,
        defaultWithMS: true,
    }) + '.' + nanos;
}

const getStyles = (theme: GrafanaTheme2) => ({
    jsonWrap: css({
        width: '100%',
    }),
    lineWrap: css({
        display: 'flex',
    }),
});
