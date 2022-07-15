import React, { useContext, useState } from 'react';
import PropTypes from 'prop-types';

import UserContext from 'contexts/UserContext';

const CubeContext = React.createContext({
  cube: {},
  canEdit: false,
  cubeID: null,
  hasCustomImages: false,
  updateCubeCard: () => {},
  updateCubeCards: () => {},
});

export const CubeContextProvider = ({ initialCube, cards, children }) => {
  const [cube, setCube] = useState({
    ...initialCube,
    cards,
  });

  const user = useContext(UserContext);

  const canEdit = user && cube.Owner === user.Id;

  const hasCustomImages = cards.boards
    .find((board) => board.name === 'Mainboard')
    .cards.some((card) => (card.imgUrl && card.imgUrl.length > 0) || (card.imgBackUrl && card.imgBackUrl.length > 0));

  const value = { cube, canEdit, hasCustomImages, setCube };

  return <CubeContext.Provider value={value}>{children}</CubeContext.Provider>;
};

CubeContextProvider.propTypes = {
  initialCube: PropTypes.shape({
    cards: PropTypes.arrayOf(PropTypes.object),
  }),
  cards: PropTypes.shape({
    boards: PropTypes.arrayOf(PropTypes.object),
  }).isRequired,
  children: PropTypes.node.isRequired,
};

CubeContextProvider.defaultProps = {
  initialCube: {},
};

export default CubeContext;
