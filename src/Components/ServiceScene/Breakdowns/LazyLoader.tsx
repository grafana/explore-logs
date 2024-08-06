import React, { ForwardRefExoticComponent, useImperativeHandle, useRef, useState } from 'react';
import { useEffectOnce } from 'react-use';

import { uniqueId } from 'lodash';

export function useUniqueId(): string {
  const idRefLazy = useRef<string | undefined>(undefined);
  idRefLazy.current ??= uniqueId();
  return idRefLazy.current;
}

export interface Props extends Omit<React.HTMLProps<HTMLDivElement>, 'onChange' | 'children'> {
  children: React.ReactNode | (({ isInView }: { isInView: boolean }) => React.ReactNode);
  key: string;
  isHidden?: boolean;
  onLoad?: () => void;
  onChange?: (isInView: boolean) => void;
}

export interface LazyLoaderType extends ForwardRefExoticComponent<Props> {
  addCallback: (id: string, c: (e: IntersectionObserverEntry) => void) => void;
  callbacks: Record<string, (e: IntersectionObserverEntry) => void>;
  observer: IntersectionObserver;
}

export const LazyLoader: LazyLoaderType = React.forwardRef<HTMLDivElement, Props>(
  ({ children, onLoad, onChange, isHidden, ...rest }, ref) => {
    const id = useUniqueId();
    const [loaded, setLoaded] = useState(false);
    const [isInView, setIsInView] = useState(false);
    const innerRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => innerRef.current!);

    useEffectOnce(() => {
      LazyLoader.addCallback(id, (entry) => {
        if (!loaded && entry.isIntersecting) {
          setLoaded(true);
          onLoad?.();
        }

        setIsInView(entry.isIntersecting);
        onChange?.(entry.isIntersecting);
      });

      const wrapperEl = innerRef.current;

      if (wrapperEl) {
        LazyLoader.observer.observe(wrapperEl);
      }

      return () => {
        delete LazyLoader.callbacks[id];
        wrapperEl && LazyLoader.observer.unobserve(wrapperEl);
        if (Object.keys(LazyLoader.callbacks).length === 0) {
          LazyLoader.observer.disconnect();
        }
      };
    });

    if (isHidden) {
      return null;
    }

    return (
      <div id={id} ref={innerRef} {...rest}>
        {loaded && (typeof children === 'function' ? children({ isInView }) : children)}
      </div>
    );
  }
) as LazyLoaderType;

LazyLoader.displayName = 'LazyLoader';
LazyLoader.callbacks = {} as Record<string, (e: IntersectionObserverEntry) => void>;
LazyLoader.addCallback = (id: string, c: (e: IntersectionObserverEntry) => void) => (LazyLoader.callbacks[id] = c);
LazyLoader.observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      LazyLoader.callbacks[entry.target.id](entry);
    }
  },
  { rootMargin: '100px' }
);
