import React, { Dispatch, ReactNode, SetStateAction } from 'react';

import { RotoPick, RotoPlayer } from '../utils/rotodraft';

import useQueryParam from 'hooks/useQueryParam';

interface RotoInfo {
  picks: Record<string, RotoPick>;
  players: Record<string, RotoPlayer>;
  picksByPlayer: Record<string, RotoPick[]>;
  // Maps overall pick number (as string key) to cube card indexes
  cardIndexMapping?: Record<number, number>;
}

interface RotoDraftContextType {
  url: string;
  setUrl: Dispatch<SetStateAction<string>>;
  rotoInfo: RotoInfo;
  setRotoInfo: Dispatch<SetStateAction<RotoInfo>>;
  getPickByNameAndIndex: (cardName: string, cardCopyIndex: number) => undefined | RotoPick;
  assignCardIndexes: (cubeCards: any[]) => void; // Function to assign cube indexes to picks
}

const defaultFn = () => {
  throw new Error('Error: Attempt to call RotoDraftContext function before initialization.');
};

const RotoDraftContext = React.createContext<RotoDraftContextType>({
  url: '',
  setUrl: defaultFn,
  rotoInfo: { picks: {}, players: {}, picksByPlayer: {} },
  setRotoInfo: defaultFn,
  getPickByNameAndIndex: () => undefined,
  assignCardIndexes: () => {},
});

export const getBaseCardName = (cardName: string) => {
  return cardName.replace(/ \d+$/, '').toLowerCase();
};

export const RotoDraftContextProvider = ({ children }: { children: ReactNode }) => {
  const [url, setUrl] = useQueryParam('rotoURL', '');
  const [rotoInfo, setRotoInfo] = React.useState<RotoInfo>({ picks: {}, players: {}, picksByPlayer: {} });

  const getPickByNameAndIndex = (_cardName: string, cubeCardIndex: number): undefined | RotoPick => {
    // Use the cardIndexMapping to find which pick corresponds to this cube card
    const cardIndexMapping = rotoInfo.cardIndexMapping || {};

    // Look through the mapping to find which overall pick number corresponds to this cube index
    for (const [overallPickNumberStr, cubeIndex] of Object.entries(cardIndexMapping)) {
      if (cubeIndex === cubeCardIndex) {
        // Found the mapping, now find the pick with this overall pick number
        return Object.values(rotoInfo.picks).find((pick) => pick.overallPickNumber === parseInt(overallPickNumberStr));
      }
    }

    return undefined;
  };

  const assignCardIndexes = React.useCallback(
    (cubeCards: any[]) => {
      if (!rotoInfo.picks || Object.keys(rotoInfo.picks).length === 0) {
        return;
      }

      // Create a mapping of base card names to available cube indexes (in cube order)
      const cardNameToIndexes: Record<string, number[]> = {};
      cubeCards.forEach((card) => {
        const baseCardName = getBaseCardName(card.details?.name || card.cardID);
        if (!cardNameToIndexes[baseCardName]) {
          cardNameToIndexes[baseCardName] = [];
        }
        cardNameToIndexes[baseCardName].push(card.index);
      });

      // Group picks by base card name and sort each group by overall pick number
      const picksByBaseName: Record<string, RotoPick[]> = {};
      Object.values(rotoInfo.picks).forEach((pick) => {
        const base = getBaseCardName(pick.cardName);
        if (!picksByBaseName[base]) picksByBaseName[base] = [];
        picksByBaseName[base].push(pick);
      });

      Object.keys(picksByBaseName).forEach((base) => {
        picksByBaseName[base].sort((a, b) => a.overallPickNumber - b.overallPickNumber);
      });

      const cardIndexMapping: Record<number, number> = {};

      // For each base name, assign the i-th pick to the i-th available cube card index
      Object.entries(picksByBaseName).forEach(([base, picks]) => {
        const availableIndexes = cardNameToIndexes[base] || [];
        for (let i = 0; i < picks.length; i++) {
          const pick = picks[i];
          const cubeIndex = availableIndexes[i];
          if (cubeIndex !== undefined) {
            cardIndexMapping[pick.overallPickNumber] = cubeIndex;
          }
        }
      });

      // Update the roto info with the card index mapping (keys are overall pick numbers)
      setRotoInfo((prev) => ({
        ...prev,
        cardIndexMapping,
      }));
    },
    [rotoInfo.picks],
  );

  const value = {
    url,
    setUrl,
    rotoInfo,
    setRotoInfo,
    getPickByNameAndIndex,
    assignCardIndexes,
  };

  return <RotoDraftContext.Provider value={value}>{children}</RotoDraftContext.Provider>;
};

export default RotoDraftContext;
