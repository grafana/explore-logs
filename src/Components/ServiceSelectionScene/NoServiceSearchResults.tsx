import React from 'react';
import { GrotError } from 'Components/GrotError';

export const NoServiceSearchResults = () => {
  return (
    <GrotError>
      <p>No service matched your search.</p>
    </GrotError>
  );
};
