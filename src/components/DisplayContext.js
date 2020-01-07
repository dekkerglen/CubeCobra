/* Holds general display settings. */

import React, { useCallback, useState } from 'react';

const DisplayContext = React.createContext({
  showCustomImages: true,
  compressedView: false,
});

export const DisplayContextProvider = (props) => {
  const [showCustomImages, setShowCustomImages] = useState(true);
  const toggleShowCustomImages = useCallback(() => {
    setShowCustomImages(!showCustomImages);
  }, [showCustomImages]);

  const [compressedView, setCompressedView] = useState(() => {
    return typeof localStorage !== 'undefined' && localStorage.getItem('compressed') === 'true';
  });
  const toggleCompressedView = useCallback(() => {
    localStorage.setItem('compressed', !compressedView);
    setCompressedView(!compressedView);
  }, [compressedView]);

  const value = { showCustomImages, toggleShowCustomImages, compressedView, toggleCompressedView };
  return <DisplayContext.Provider value={value} {...props} />;
};

export default DisplayContext;
