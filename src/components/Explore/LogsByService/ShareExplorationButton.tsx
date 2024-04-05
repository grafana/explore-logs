import React, { useRef, useState } from 'react';
import { useLocation } from 'react-use';

import { ToolbarButton } from '@grafana/ui';

import { LogExploration } from '../../../pages/Explore';
import { copyText, getUrlForExploration } from '../../../utils/utils';
import { config } from '@grafana/runtime';

interface ShareExplorationButtonState {
  exploration: LogExploration;
}

export const ShareExplorationButton = ({ exploration }: ShareExplorationButtonState) => {
  const { origin } = useLocation();
  const [tooltip, setTooltip] = useState('Copy url');
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const onShare = () => {
    const body = document.querySelector('body');
    if (!body) {
      return;
    }
    const subUrl = config.appSubUrl ?? '';
    copyText(`${subUrl}${origin}${getUrlForExploration(exploration)}`, buttonRef);
    setTooltip('Copied!');
    setTimeout(() => {
      setTooltip('Copy url');
    }, 2000);
  };

  return <ToolbarButton variant={'canvas'} icon={'share-alt'} tooltip={tooltip} ref={buttonRef} onClick={onShare} />;
};
