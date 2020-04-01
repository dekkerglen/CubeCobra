import React, { useCallback, useState } from 'react';
import PropTypes from 'prop-types';

const CubeContext = React.createContext({
  cube: {},
  canEdit: false,
  cubeID: null,
  hasCustomImages: false,
  updateCubeCard: () => {},
  updateCubeCards: () => {},
});

export const CubeContextProvider = ({ initialCube, canEdit, cubeID, ...props }) => {
  const [cube, setCube] = useState({
    ...initialCube,
    cards: initialCube.cards ? initialCube.cards.map((card, index) => ({ ...card, index })) : [],
  });

  const updateCubeCard = useCallback((index, newCard) => {
    setCube((currentCube) => {
      const newCube = { ...currentCube };
      newCube.cards = [...newCube.cards];
      newCube.cards[index] = newCard;
      return newCube;
    });
  }, []);

  const updateCubeCards = useCallback((newCards) => {
    setCube((currentCube) => {
      const newCube = { ...currentCube };
      newCube.cards = [...newCube.cards];
      for (const card of newCards) {
        newCube.cards[card.index] = card;
      }
      return newCube;
    });
  }, []);

  const hasCustomImages = cube.cards.some((card) => card.imgUrl && card.imgUrl.length > 0);

  const value = { cube, canEdit, cubeID, hasCustomImages, setCube, updateCubeCard, updateCubeCards };

  return <CubeContext.Provider value={value} {...props} />;
};

CubeContextProvider.propTypes = {
  initialCube: PropTypes.shape({
    cards: PropTypes.arrayOf(PropTypes.object),
  }),
  canEdit: PropTypes.bool,
  cubeID: PropTypes.string.isRequired,
};

CubeContextProvider.defaultProps = {
  initialCube: {},
  canEdit: false,
};

export default CubeContext;
