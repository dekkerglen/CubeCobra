import React, { useCallback, useState } from 'react';

const MaybeboardContext = React.createContext({
  maybeboard: [],
  addCard: () => {},
  removeCard: () => {},
});

export const MaybeboardContextProvider = ({ initialCards, ...props }) => {
  const [maybeboard, setMaybeboard] = useState([...initialCards]);

  const addMaybeboardCard = useCallback((card) => {
    setMaybeboard(maybeboard => [...maybeboard, { ...card, index: maybeboard.length }]);
  }, []);
  const removeMaybeboardCard = useCallback((removeIndex) => {
    setMaybeboard(maybeboard => maybeboard.filter((card, index) => index !== removeIndex));
  }, []);

  const value = { maybeboard, addMaybeboardCard, removeMaybeboardCard };

  return <MaybeboardContext.Provider value={value} {...props} />;
};

export default MaybeboardContext;
