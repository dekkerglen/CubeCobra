import React, { useCallback, useState } from 'react';

const CubeContext = React.createContext({
  cube: [],
  canEdit: false,
  cubeID: null,
  updateCubeCard: (index, newCard) => {},
});

export const CubeContextProvider = ({ initialCube, canEdit, cubeID, ...props }) => {
  const [cube, setCube] = useState(initialCube.map((card, index) => ({ ...card, index })));

  const updateCubeCard = useCallback(
    (index, newCard) => {
      const newCube = [...cube];
      newCube[index] = newCard;
      setCube(newCube);
    },
    [cube],
  );

  const updateCubeCards = useCallback(
    (newCards) => {
      const newCube = [...cube];
      for (const card of newCards) {
        newCube[card.index] = card;
      }
      setCube(newCube);
    },
    [cube],
  );

  const value = { cube, cubeID, updateCubeCard, updateCubeCards };

  return <CubeContext.Provider value={value} {...props} />;
};

export default CubeContext;
