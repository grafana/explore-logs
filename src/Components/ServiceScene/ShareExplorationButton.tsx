import React, { useRef, useState } from 'react';
import { useLocation } from 'react-use';

import { ToolbarButton } from '@grafana/ui';

import { config } from '@grafana/runtime';
import { getUrlForExploration } from 'services/scenes';
import { copyText } from 'services/text';
import { IndexScene } from 'Components/IndexScene/IndexScene';

interface ShareExplorationButtonState {
  exploration: IndexScene;
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
    copyText(`${origin}${subUrl}${getUrlForExploration(exploration)}`, buttonRef);
    setTooltip('Copied!');
    setTimeout(() => {
      setTooltip('Copy url');
    }, 2000);
  };

  return <ToolbarButton variant={'canvas'} icon={'share-alt'} tooltip={tooltip} ref={buttonRef} onClick={onShare} />;
};
