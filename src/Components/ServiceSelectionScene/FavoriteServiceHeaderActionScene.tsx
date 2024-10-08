import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import React from 'react';
import { Icon, IconType, useStyles2 } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';
import {
  addToFavoriteLabelValueInStorage,
  getFavoriteLabelValuesFromStorage,
  removeFromFavoritesInStorage,
} from '../../services/store';

export interface FavoriteServiceHeaderActionSceneState extends SceneObjectState {
  labelValue: string;
  labelName: string;
  ds: string;
  hover?: boolean;
}
export class FavoriteServiceHeaderActionScene extends SceneObjectBase<FavoriteServiceHeaderActionSceneState> {
  public setHover(hover: boolean) {
    this.setState({
      hover,
    });
  }

  public getIconType(isFavorite: boolean): IconType {
    if (isFavorite) {
      return this.state.hover ? 'default' : 'solid';
    }
    return this.state.hover ? 'solid' : 'default';
  }

  public onClick(isFavorite: boolean) {
    if (isFavorite) {
      // Remove from favorites
      removeFromFavoritesInStorage(this.state.ds, this.state.labelName, this.state.labelValue);
    } else {
      // add to favorites
      addToFavoriteLabelValueInStorage(this.state.ds, this.state.labelName, this.state.labelValue);
    }
    // Local storage changes won't trigger re-render, so we need to force the render so the new styles are calculated
    this.forceRender();
  }

  public static Component = ({ model }: SceneComponentProps<FavoriteServiceHeaderActionScene>) => {
    const { ds, labelValue, labelName, hover } = model.useState();
    const isFavorite = getFavoriteLabelValuesFromStorage(ds, labelName).includes(labelValue);
    const styles = useStyles2((theme) => getStyles(theme, isFavorite, hover));

    return (
      <span className={styles.wrapper}>
        <Icon
          size={'lg'}
          onClick={() => model.onClick(isFavorite)}
          onMouseOut={() => {
            model.setHover(false);
          }}
          onMouseOver={() => {
            model.setHover(true);
          }}
          className={styles.icon}
          key={'key'}
          type={model.getIconType(isFavorite)}
          name={'star'}
        />
      </span>
    );
  };
}

function getStyles(theme: GrafanaTheme2, isFavorite: boolean, hover = false) {
  return {
    wrapper: css({
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
    }),
    icon: css({
      stroke: hover ? '#eee' : '#666',
      fill: isFavorite ? '#eee' : '#666',
    }),
  };
}
