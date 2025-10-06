import useQueryParam from "hooks/useQueryParam";
import React, { Dispatch, ReactNode, SetStateAction } from "react";
import { RotoPick, RotoPlayer } from "src/util/rotodraft";

interface RotoInfo {
  picks: Record<string, RotoPick>;
  players: Record<string, RotoPlayer>;
  picksByPlayer: Record<string, RotoPick[]>
}

interface RotoDraftContextType {
  url: string;
  setUrl: Dispatch<SetStateAction<string>>;
  rotoInfo: RotoInfo;
  setRotoInfo: Dispatch<SetStateAction<RotoInfo>>;
}

const defaultFn = () => {
  throw new Error('Error: Attempt to call RotoDraftContext function before initialization.');
};

const RotoDraftContext = React.createContext<RotoDraftContextType>({
  url: "",
  setUrl: defaultFn,
  rotoInfo: { picks: {}, players: {}, picksByPlayer: {} },
  setRotoInfo: defaultFn,
})

export const RotoDraftContextProvider = ({ children }: { children: ReactNode }) => {
  const [url, setUrl] = useQueryParam("rotoURL", "");
  const [rotoInfo, setRotoInfo] = React.useState<RotoInfo>({ picks: {}, players: {}, picksByPlayer: {} });

  const value = {
    url,
    setUrl,
    rotoInfo,
    setRotoInfo,
  };

  return (
    <RotoDraftContext.Provider value={value}>
      {children}
    </RotoDraftContext.Provider>
  )
}

export default RotoDraftContext;