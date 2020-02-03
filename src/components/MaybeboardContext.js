import React, { useCallback, useState } from 'react';
import PropTypes from 'prop-types';

const MaybeboardContext = React.createContext({
  maybeboard: [],
  addCard: () => {},
  removeCard: () => {},
  updateCard: () => {},
});

export const MaybeboardContextProvider = ({ initialCards, ...props }) => {
  const [maybeboard, setMaybeboard] = useState([...initialCards]);

  const addMaybeboardCard = useCallback((card) => {
    setMaybeboard((current) => [...current, card]);
  }, []);
  const removeMaybeboardCard = useCallback((removeIndex) => {
    setMaybeboard((current) => current.filter((card, index) => index !== removeIndex));
  }, []);
  const updateMaybeboardCard = useCallback((updatedCard) => {
    setMaybeboard((current) => {
      const newMaybeboard = [...current];
      const index = newMaybeboard.findIndex((card) => card._id === updatedCard._id);
      if (index > 0) {
        newMaybeboard[index] = updatedCard;
      }
      return newMaybeboard;
    });
  }, []);

  const value = { maybeboard, addMaybeboardCard, removeMaybeboardCard, updateMaybeboardCard };

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
