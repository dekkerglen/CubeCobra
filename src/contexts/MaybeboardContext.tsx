import React, { useCallback, useState, ReactNode } from 'react';
import Card from 'datatypes/Card';

interface MaybeboardContextValue {
  maybeboard: Card[];
  addMaybeboardCard: (card: Card) => void;
  removeMaybeboardCard: (removeIndex: number) => void;
  updateMaybeboardCard: (updatedCard: Card) => void;
}

const MaybeboardContext = React.createContext<MaybeboardContextValue>({
  maybeboard: [],
  addMaybeboardCard: () => {},
  removeMaybeboardCard: () => {},
  updateMaybeboardCard: () => {},
});

export const MaybeboardContextProvider: React.FC<{ initialCards: Card[] }> = ({ initialCards, ...props }) => {
  const [maybeboard, setMaybeboard] = useState<Card[]>([...initialCards]);

  const addMaybeboardCard = useCallback((card: Card) => {
    setMaybeboard((current) => [...current, card]);
  }, []);
  const removeMaybeboardCard = useCallback((removeIndex: number) => {
    setMaybeboard((current) => current.filter((card, index) => index !== removeIndex));
  }, []);
  const updateMaybeboardCard = useCallback((updatedCard: Card) => {
    setMaybeboard((current) => {
      const newMaybeboard = [...current];
      const index = newMaybeboard.findIndex((card) => card.scryfall_id === updatedCard.scryfall_id);
      if (index > 0) {
        newMaybeboard[index] = updatedCard;
      }
      return newMaybeboard;
    });
  }, []);

  const value: MaybeboardContextValue = { maybeboard, addMaybeboardCard, removeMaybeboardCard, updateMaybeboardCard };

  return <MaybeboardContext.Provider value={value} {...props} />;
};

export default MaybeboardContext;
