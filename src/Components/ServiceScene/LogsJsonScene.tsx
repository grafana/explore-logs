import {SceneComponentProps, SceneDataState, sceneGraph, SceneObjectBase, SceneObjectState} from "@grafana/scenes";
import React from "react";
import {JSONTree} from "react-json-tree";
import {getLogsPanelFrame} from "./ServiceScene";
import {
    AdHocVariableFilter,
    dateTimeFormat,
    FieldType,
    getTimeZone,
    GrafanaTheme2,
    LoadingState,
    PanelData
} from "@grafana/data";
import {IconButton, PanelChrome, useStyles2, useTheme2} from "@grafana/ui";
import {LogsPanelHeaderActions} from "../Table/LogsHeaderActions";
import {PanelMenu} from "../Panels/PanelMenu";
import {LogsListScene} from "./LogsListScene";
import {css} from "@emotion/css";
import {getVariableForLabel} from "../../services/fields";
import {addAdHocFilter} from "./Breakdowns/AddToFiltersButton";
import {FilterOp} from "../../services/filterTypes";

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
        const grafanaTheme = useTheme2();
        const styles = useStyles2(() => grafanaTheme);
        const {menu, data} = model.useState();
        const parentModel = sceneGraph.getAncestor(model, LogsListScene);
        const {visualizationType} = parentModel.useState();
        const theme = model.buildTheme(grafanaTheme);

        const dataFrame = getLogsPanelFrame(data);
        const lineField = dataFrame?.fields.find(field => field.type === FieldType.string && (field.name === 'Line' || field.name === 'body'))

        const addFilter = (filter: AdHocVariableFilter) => {
            const variableType = getVariableForLabel(dataFrame, filter.key, model);
            addAdHocFilter(filter, parentModel, variableType);
        };

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
                <JSONTree data={lineField?.values}
                          theme={theme}

                          getItemString={(nodeType, data1, itemType, itemString) => {
                              console.log('getItemString', {nodeType, data1, itemType, itemString})
                              return <span>{itemType} {itemString}</span>
                          }}
                    // postprocessValue={}


                          valueRenderer={(valueAsString, value, keyPath) => {
                              console.log('valueRenderer', {valueAsString, value, keyPath})
                              // @todo narrow the type?
                              // @ts-expect-error
                              return <em>{valueAsString}</em>
                          }}

                          labelRenderer={(keyPath, nodeType, expanded) => {
                              console.log('labelRenderer', {
                                  keyPath,
                                  nodeType,
                                  expanded
                              })
                              if (nodeType === 'String' || nodeType === 'Number' || nodeType === 'Boolean') {
                                  return (
                                     <span>
                                        <IconButton onClick={() => addFilter({
                                            key: keyPath[0].toString(),
                                            value: '',
                                            operator: FilterOp.Equal,
                                        })} size={'sm'} name={'plus-circle'} aria-label={'add filter'}/>
                                        <IconButton size={'sm'} name={'minus-circle'} aria-label={'remove filter'}/>
                                        <strong>{keyPath[0]}</strong>
                                    </span>
                                  )
                              }
                              return <strong>{keyPath[0]}</strong>
                          }} shouldExpandNodeInitially={(keyPath, data, level) => level <= 1}/>

            </PanelChrome>
        )
    }

    public buildTheme(grafanaTheme: GrafanaTheme2) {

        const rawTheme = {
            scheme: 'grafana',
            author: 'Grafana Labs (http://grafana.com)',
            base00: grafanaTheme.colors.background.primary, // BACKGROUND_COLOR
            base01: grafanaTheme.colors.background.canvas,
            base02: grafanaTheme.colors.background.secondary,
            base03: grafanaTheme.colors.primary.main, // ITEM_STRING_EXPANDED_COLOR
            base04: grafanaTheme.colors.primary.shade,
            base05: '#f8f8f2',
            base06: '#f5f4f1',
            base07: '#f9f8f5', // TEXT_COLOR
            base08: '#f92672', // NULL_COLOR, UNDEFINED_COLOR, FUNCTION_COLOR, SYMBOL_COLOR
            base09: '#fd971f', // NUMBER_COLOR, BOOLEAN_COLOR
            base0A: '#f4bf75',
            base0B: '#a6e22e', // STRING_COLOR, DATE_COLOR, ITEM_STRING_COLOR
            base0C: '#a1efe4', // label name
            base0D: '#66d9ef', // LABEL_COLOR, ARROW_COLOR
            base0E: '#ae81ff',
            base0F: '#cc6633',
        }

        // const colorMap = (theme: Record<string, string>) => ({
        //     BACKGROUND_COLOR: theme.base00,
        //     TEXT_COLOR: theme.base07,
        //     STRING_COLOR: theme.base0B,
        //     DATE_COLOR: theme.base0B,
        //     NUMBER_COLOR: theme.base09,
        //     BOOLEAN_COLOR: theme.base09,
        //     NULL_COLOR: theme.base08,
        //     UNDEFINED_COLOR: theme.base08,
        //     FUNCTION_COLOR: theme.base08,
        //     SYMBOL_COLOR: theme.base08,
        //     LABEL_COLOR: theme.base0D,
        //     ARROW_COLOR: theme.base0D,
        //     ITEM_STRING_COLOR: theme.base0B,
        //     ITEM_STRING_EXPANDED_COLOR: theme.base03,
        // });

        return rawTheme
    }

    public onActivate() {
        this.setState({
            menu: new PanelMenu({addExplorationsLink: false}),
        });

        const $data = sceneGraph.getData(this)
        console.log('broken sub?', $data)
        if ($data.state.data?.state === LoadingState.Done) {
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
        if (newState.data) {
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
                                            // @todo ns? This will remove leading zeros
                                            Time: renderTimeStamp(time?.values?.[i], parseInt(timeNs?.values[i], 10) - time?.values?.[i] * 1000000, timeZone),
                                            Line: parsed,
                                            // @todo labels? Allow filtering when key has same name as label?
                                            Labels: labels?.values[i],
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
