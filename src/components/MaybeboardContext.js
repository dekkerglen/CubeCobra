import React, { useCallback, useState } from 'react';
import PropTypes from 'prop-types';

const MaybeboardContext = React.createContext({
  maybeboard: [],
  addCard: () => {},
  removeCard: () => {},
});

export const MaybeboardContextProvider = ({ initialCards, ...props }) => {
  const [maybeboard, setMaybeboard] = useState([...initialCards]);

  const addMaybeboardCard = useCallback((card) => {
    setMaybeboard((maybeboard) => [...maybeboard, { ...card, index: maybeboard.length }]);
  }, []);
  const removeMaybeboardCard = useCallback((removeIndex) => {
    setMaybeboard((maybeboard) => maybeboard.filter((card, index) => index !== removeIndex));
  }, []);

  const value = { maybeboard, addMaybeboardCard, removeMaybeboardCard };

  return <MaybeboardContext.Provider value={value} {...props} />;
};

MaybeboardContextProvider.propTypes = {
  initialCards: PropTypes.arrayOf(
    PropTypes.shape({
      _id: PropTypes.string.isRequired,
      cardID: PropTypes.string.isRequired,
      details: PropTypes.shape({
        _id: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired,
        image_normal: PropTypes.string.isRequired,
      }),
    }),
  ).isRequired,
};

export default MaybeboardContext;
