import {
  SceneComponentProps,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  SceneTimeRangeLike,
} from '@grafana/scenes';
import { ButtonGroup, Dropdown, IconName, Menu, MenuGroup, ToolbarButton } from '@grafana/ui';
import React from 'react';
import { config, getAppEvents, getBackendSrv, locationService, reportInteraction } from '@grafana/runtime';
import { AppEvents, toUtc, urlUtil } from '@grafana/data';
import { copyText } from '../../services/text';

interface ShortLinkMenuItemData {
  key: string;
  label: string;
  icon: IconName;
  getUrl: Function;
  shorten: boolean;
  absTime: boolean;
}

interface ShortLinkGroupData {
  key: string;
  label: string;
  items: ShortLinkMenuItemData[];
}

export interface ShareButtonSceneState extends SceneObjectState {
  lastSelected: ShortLinkMenuItemData;
  isOpen: boolean;
  /**
   * Reference to $timeRange
   */
  getSceneTimeRange?: () => SceneTimeRangeLike;
  /**
   * Callback on link copy
   */
  onCopyLink?: (shortened: boolean, absTime: boolean, url?: string) => void;
}

export class ShareButtonScene extends SceneObjectBase<ShareButtonSceneState> {
  constructor(state: Partial<ShareButtonSceneState>) {
    super({ isOpen: false, lastSelected: defaultMode, ...state });
  }

  public setIsOpen(isOpen: boolean) {
    this.setState({ isOpen });
  }

  public onCopyLink(shorten: boolean, absTime: boolean, url?: string) {
    if (shorten) {
      createAndCopyShortLink(url || global.location.href);
      reportInteraction('grafana_explore_shortened_link_clicked', { isAbsoluteTime: absTime });
    } else {
      copyText(
        url !== undefined
          ? `${window.location.protocol}//${window.location.host}${config.appSubUrl}${url}`
          : global.location.href
      );

      if (this.state.onCopyLink) {
        this.state.onCopyLink(shorten, absTime, url);
      }
    }
  }

  static MenuActions = ({ model }: SceneComponentProps<ShareButtonScene>) => {
    const menuOptions: ShortLinkGroupData[] = [
      {
        key: 'normal',
        label: 'Normal URL links',
        items: [
          {
            key: 'copy-shortened-link',
            icon: 'link',
            label: 'Copy shortened URL',
            getUrl: () => undefined,
            shorten: true,
            absTime: false,
          },
          {
            key: 'copy-link',
            icon: 'link',
            label: 'Copy URL',
            getUrl: () => undefined,
            shorten: false,
            absTime: false,
          },
        ],
      },
      {
        key: 'timesync',
        label: 'Time-sync URL links (share with time range intact)',
        items: [
          {
            key: 'copy-short-link-abs-time',
            icon: 'clock-nine',
            label: 'Copy absolute shortened URL',
            shorten: true,
            getUrl: () => {
              return constructAbsoluteUrl(
                model.state.getSceneTimeRange !== undefined
                  ? model.state.getSceneTimeRange()
                  : sceneGraph.getTimeRange(model)
              );
            },
            absTime: true,
          },
          {
            key: 'copy-link-abs-time',
            icon: 'clock-nine',
            label: 'Copy absolute URL',
            shorten: false,
            getUrl: () => {
              return constructAbsoluteUrl(
                model.state.getSceneTimeRange !== undefined
                  ? model.state.getSceneTimeRange()
                  : sceneGraph.getTimeRange(model)
              );
            },
            absTime: true,
          },
        ],
      },
    ];

    return (
      <Menu>
        {menuOptions.map((groupOption) => {
          return (
            <MenuGroup key={groupOption.key} label={groupOption.label}>
              {groupOption.items.map((option) => {
                return (
                  <Menu.Item
                    key={option.key}
                    label={option.label}
                    icon={option.icon}
                    onClick={() => {
                      const url = option.getUrl();
                      model.onCopyLink(option.shorten, option.absTime, url);
                      model.setState({
                        lastSelected: option,
                      });
                    }}
                  />
                );
              })}
            </MenuGroup>
          );
        })}
      </Menu>
    );
  };

  static Component = ({ model }: SceneComponentProps<ShareButtonScene>) => {
    const { lastSelected, isOpen } = model.useState();

    return (
      <ButtonGroup>
        <ToolbarButton
          tooltip={lastSelected.label}
          icon={lastSelected.icon}
          variant={'canvas'}
          narrow={true}
          onClick={() => {
            const url = lastSelected.getUrl();
            model.onCopyLink(lastSelected.shorten, lastSelected.absTime, url);
          }}
          aria-label={'Copy shortened URL'}
        >
          <span>Share</span>
        </ToolbarButton>
        <Dropdown
          overlay={<ShareButtonScene.MenuActions model={model} />}
          placement="bottom-end"
          onVisibleChange={model.setIsOpen.bind(model)}
        >
          <ToolbarButton narrow={true} variant={'canvas'} isOpen={isOpen} aria-label={'Open copy link options'} />
        </Dropdown>
      </ButtonGroup>
    );
  };
}

const defaultMode: ShortLinkMenuItemData = {
  key: 'copy-link',
  label: 'Copy shortened URL',
  icon: 'share-alt',
  getUrl: () => undefined,
  shorten: true,
  absTime: false,
};

// Adapted from grafana/grafana/public/app/core/utils/shortLinks.ts shortLinks.ts
function buildHostUrl() {
  return `${window.location.protocol}//${window.location.host}${config.appSubUrl}`;
}

function getRelativeURLPath(url: string) {
  let path = url.replace(buildHostUrl(), '');
  return path.startsWith('/') ? path.substring(1, path.length) : path;
}

export const createShortLink = async function (path: string) {
  const appEvents = getAppEvents();
  try {
    const shortLink = await getBackendSrv().post(`/api/short-urls`, {
      path: getRelativeURLPath(path),
    });
    return shortLink.url;
  } catch (err) {
    console.error('Error when creating shortened link: ', err);

    appEvents.publish({
      type: AppEvents.alertError.name,
      payload: ['Error generating shortened link'],
    });
  }
};

export const createAndCopyShortLink = async (path: string) => {
  const appEvents = getAppEvents();
  const shortLink = await createShortLink(path);
  if (shortLink) {
    copyText(shortLink);
    appEvents.publish({
      type: AppEvents.alertSuccess.name,
      payload: ['Shortened link copied to clipboard'],
    });
  } else {
    appEvents.publish({
      type: AppEvents.alertError.name,
      payload: ['Error generating shortened link'],
    });
  }
};

/**
 * Adapted from /grafana/grafana/public/app/features/explore/utils/links.ts
 * Returns the current URL with absolute time range
 */
const constructAbsoluteUrl = (timeRange: SceneTimeRangeLike): string => {
  const from = toUtc(timeRange.state.value.from);
  const to = toUtc(timeRange.state.value.to);
  const location = locationService.getLocation();
  const searchParams = urlUtil.getUrlSearchParams();
  searchParams['from'] = from.toISOString();
  searchParams['to'] = to.toISOString();
  return urlUtil.renderUrl(location.pathname, searchParams);
};
