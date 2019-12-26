import React, { useCallback, useState } from 'react';

const CubeContext = React.createContext({
  cube: [],
  updateCubeCard: (index, newCard) => {},
});

export const CubeContextProvider = ({ initialCube, ...props }) => {
  const [cube, setCube] = useState(initialCube.map((card, index) => ({ ...card, index })));

  const updateCubeCard = useCallback((index, newCard) => {
    const newCube = [...cube];
    newCube[index] = newCard;
    setCube(newCube);
  }, [cube]);

  const value = { cube, updateCubeCard };

  return <CubeContext.Provider value={value} {...props} />;
};

export default CubeContext;
