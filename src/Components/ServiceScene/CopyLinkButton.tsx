import { LogRowModel } from "@grafana/data";
import { IconButton } from "@grafana/ui";
import React, { MouseEvent, useCallback, useEffect, useRef, useState } from "react";

interface Props {
  onClick(event: MouseEvent<HTMLElement>, row?: LogRowModel): void;
}

export const CopyLinkButton = ({ onClick }: Props) => {
  const [copied, setCopied] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    if (copied) {
      timeoutId = setTimeout(() => {
        setCopied(false);
      }, 2000);
    }

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [copied]);

  const handleClick = useCallback((event: MouseEvent<HTMLElement>, row?: LogRowModel) => {
    setCopied(true);
    onClick(event, row);
  }, [onClick]);

  return (
    <IconButton
      aria-label="Copy link to log line"
      tooltip={copied ? "Copied" : "Copy link to log line"}
      tooltipPlacement="top"
      size="md"
      name={copied ? "check" : "share-alt"}
      onClick={handleClick}
      ref={buttonRef}
    />
  )
}
