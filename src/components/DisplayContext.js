/* Holds general display settings. */

import React, { useCallback, useState } from 'react';

const DisplayContext = React.createContext({
  showCustomImages: true,
  compressedView: false,
  showMaybeboard: false,
});

export const DisplayContextProvider = ({ cubeID, ...props }) => {
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

  const [showMaybeboard, setShowMaybeboard] = useState(() => {
    return typeof localStorage !== 'undefined' && cubeID && localStorage.getItem(`maybeboard-${cubeID}`) === 'true';
  });
  const toggleShowMaybeboard = useCallback(() => {
    cubeID && localStorage.setItem(`maybeboard-${cubeID}`, !showMaybeboard);
    setShowMaybeboard(!showMaybeboard);
  }, [cubeID, showMaybeboard]);

  const value = { showCustomImages, toggleShowCustomImages, compressedView, toggleCompressedView, showMaybeboard, toggleShowMaybeboard };
  return <DisplayContext.Provider value={value} {...props} />;
};

export default DisplayContext;
