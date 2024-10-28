import { LogRowModel } from '@grafana/data';
import { IconButton } from '@grafana/ui';
import React, { MouseEvent, useCallback, useEffect, useState } from 'react';

interface Props {
  onClick(event: MouseEvent<HTMLElement>, row?: LogRowModel): void;
}

export const CopyLinkButton = ({ onClick }: Props) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    if (copied) {
      timeoutId = setTimeout(() => {
        setCopied(false);
      }, 2000);
    }

    return () => {
      clearTimeout(timeoutId);
    };
  }, [copied]);

  const handleClick = useCallback(
    (event: MouseEvent<HTMLElement>, row?: LogRowModel) => {
      onClick(event, row);
      setCopied(true);
    },
    [onClick]
  );

  return (
    <IconButton
      aria-label={copied ? 'Copied' : 'Copy link to log line'}
      tooltip={copied ? 'Copied' : 'Copy link to log line'}
      tooltipPlacement="top"
      variant={copied ? 'primary' : 'secondary'}
      size="md"
      name={copied ? 'check' : 'share-alt'}
      onClick={handleClick}
    />
  );
};
