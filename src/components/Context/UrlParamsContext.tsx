import React, { createContext, ReactNode, useCallback, useContext, useState } from 'react';

import { locationService } from '@grafana/runtime';

type UrlParamsContextType = {
  setUrlParameter<T>(key: string, value: T): void;
  getUrlParameter<T>(key: string): T | null;
  searchParams: URLSearchParams | null;
};

const initalState = {
  setUrlParameter: (_: string, __: unknown) => {},
  getUrlParameter: (_: string) => JSON.parse('0'),
  searchParams: null,
};

const UrlParamsContext = createContext<UrlParamsContextType>(initalState);

export const UrlParamsContextProvider = ({ children }: { children: ReactNode }) => {
  const search = locationService.getLocation().search;
  const [searchParams, setSearchParams] = useState(new URLSearchParams(search));

  const getUrlParameter = useCallback(
    (key: string) => {
      let param = searchParams.get(key);
      if (param === null) {
        return param;
      }

      try {
        return JSON.parse(param);
      } catch (e) {
        console.error(`Error parsing query parameter '${key}' as JSON`, e);
        return param;
      }
    },
    [searchParams]
  );

  const setUrlParameter = useCallback(
    <T,>(key: string, value: T) => {
      const searchParams = new URLSearchParams(search);
      searchParams.set(key, JSON.stringify(value));

      const searchParamsObj: Record<string, string> = {};
      searchParams.forEach((value, key) => {
        searchParamsObj[key] = value;
      });

      locationService.partial(searchParamsObj, true);
      setSearchParams(new URLSearchParams(searchParams));
    },
    [search]
  );

  return (
    <UrlParamsContext.Provider value={{ getUrlParameter, setUrlParameter, searchParams }}>
      {children}
    </UrlParamsContext.Provider>
  );
};

export const useUrlParamsContext = () => {
  return useContext(UrlParamsContext);
};
