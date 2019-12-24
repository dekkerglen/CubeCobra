/* Holds general display settings. */

import React, { useCallback, useState } from 'react';

const DisplayContext = React.createContext({
  showCustomImages: true,
});

export const DisplayContextProvider = (props) => {
  const [showCustomImages, setShowCustomImages] = useState(true);
  const toggleShowCustomImages = useCallback(() => {
    setShowCustomImages(!showCustomImages)
  }, [showCustomImages]);
  const value = { showCustomImages, toggleShowCustomImages };
  return <DisplayContext.Provider value={value} {...props} />;
};

export default DisplayContext;
