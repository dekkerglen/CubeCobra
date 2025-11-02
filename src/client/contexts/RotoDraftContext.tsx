import useQueryParam from 'hooks/useQueryParam';
import React, { Dispatch, ReactNode, SetStateAction } from 'react';
import { RotoPick, RotoPlayer } from 'src/util/rotodraft';

interface RotoInfo {
  picks: Record<string, RotoPick>;
  players: Record<string, RotoPlayer>;
  picksByPlayer: Record<string, RotoPick[]>;
}

interface RotoDraftContextType {
  url: string;
  setUrl: Dispatch<SetStateAction<string>>;
  rotoInfo: RotoInfo;
  setRotoInfo: Dispatch<SetStateAction<RotoInfo>>;
  getPickByName: (cardName: string) => undefined | RotoPick;
}

const defaultFn = () => {
  throw new Error('Error: Attempt to call RotoDraftContext function before initialization.');
};

const RotoDraftContext = React.createContext<RotoDraftContextType>({
  url: '',
  setUrl: defaultFn,
  rotoInfo: { picks: {}, players: {}, picksByPlayer: {} },
  setRotoInfo: defaultFn,
  getPickByName: (_: string) => undefined,
});

export const getBaseCardName = (cardName: string) => {
  return cardName.replace(/ \d+$/, '').toLowerCase();
};

const displayedCounts: Record<string, number> = {};

export const RotoDraftContextProvider = ({ children }: { children: ReactNode }) => {
  const [url, setUrl] = useQueryParam('rotoURL', '');
  const [rotoInfo, setRotoInfo] = React.useState<RotoInfo>({ picks: {}, players: {}, picksByPlayer: {} });

  const getPickByName = (cardName: string) => {
    const baseCardName = getBaseCardName(cardName);

    if (displayedCounts[baseCardName]) {
      // duplicate!

      const numDuplicatePicks = Object.keys(rotoInfo.picks).filter((pickName) => {
        return getBaseCardName(pickName) === baseCardName;
      }).length;

      // all picks of the duplicate card are already displayed, don't display any more
      if (displayedCounts[baseCardName] >= numDuplicatePicks) return undefined;

      displayedCounts[baseCardName] += 1;
    } else {
      displayedCounts[baseCardName] = 1;
    }

    return displayedCounts[baseCardName] > 1
      ? rotoInfo.picks[`${cardName.toLowerCase()} ${displayedCounts[baseCardName]}`]
      : rotoInfo.picks[cardName.toLowerCase()];
  };

  const value = {
    url,
    setUrl,
    rotoInfo,
    setRotoInfo,
    getPickByName,
  };

  return <RotoDraftContext.Provider value={value}>{children}</RotoDraftContext.Provider>;
};

export default RotoDraftContext;
