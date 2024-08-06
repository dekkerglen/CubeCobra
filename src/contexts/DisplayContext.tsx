import React, { ReactNode, useCallback, useState } from 'react';

import useLocalStorage from 'hooks/useLocalStorage';

export interface DisplayContextValue {
  showCustomImages: boolean;
  toggleShowCustomImages: () => void;
  compressedView: boolean;
  toggleCompressedView: () => void;
  showMaybeboard: boolean;
  toggleShowMaybeboard: () => void;
  openCollapse: string | null;
  setOpenCollapse: React.Dispatch<React.SetStateAction<string | null>>;
}

const DisplayContext = React.createContext<DisplayContextValue>({
  showCustomImages: true,
  compressedView: false,
  showMaybeboard: false,
  toggleShowCustomImages: () => {},
  toggleCompressedView: () => {},
  toggleShowMaybeboard: () => {},
  openCollapse: null,
  setOpenCollapse: () => {},
});

interface DisplayContextProviderProps {
  cubeID: string;
  children: ReactNode;
}

export const DisplayContextProvider: React.FC<DisplayContextProviderProps> = ({ cubeID, ...props }) => {
  const [showCustomImages, setShowCustomImages] = useLocalStorage<boolean>('showcustomimages', true);
  const [openCollapse, setOpenCollapse] = useState<string | null>(null);

  const toggleShowCustomImages = useCallback(() => {
    setShowCustomImages((prev) => !prev);
  }, [setShowCustomImages]);

  const [compressedView, setCompressedView] = useState<boolean>(() => {
    return typeof localStorage !== 'undefined' && localStorage.getItem('compressed') === 'true';
  });
  const toggleCompressedView = useCallback(() => {
    localStorage.setItem('compressed', (!compressedView).toString());
    setCompressedView((prev) => !prev);
  }, [compressedView]);

  const [showMaybeboard, setShowMaybeboard] = useState<boolean>(() => {
    return (
      typeof localStorage !== 'undefined' &&
      typeof cubeID === 'string' &&
      localStorage.getItem(`maybeboard-${cubeID}`) === 'true'
    );
  });
  const toggleShowMaybeboard = useCallback(() => {
    if (cubeID) localStorage.setItem(`maybeboard-${cubeID}`, (!showMaybeboard).toString());
    setShowMaybeboard((prev) => !prev);
  }, [cubeID, showMaybeboard]);

  const value: DisplayContextValue = {
    showCustomImages,
    toggleShowCustomImages,
    compressedView,
    toggleCompressedView,
    showMaybeboard,
    toggleShowMaybeboard,
    openCollapse,
    setOpenCollapse,
  };
  return <DisplayContext.Provider value={value} {...props} />;
};

export default DisplayContext;
