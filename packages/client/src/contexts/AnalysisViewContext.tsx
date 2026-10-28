import React, { ReactNode, useCallback, useContext, useMemo } from 'react';

import Card from '@utils/datatypes/Card';

import useQueryParam from '../hooks/useQueryParam';
import CubeContext from './CubeContext';

const DEFAULT_BOARDS = ['mainboard'];

interface AnalysisViewContextValue {
  view: string;
  setView: (view: string) => void;
  // Board keys whose cards feed the analytics views.
  boards: string[];
  setBoards: (boards: string[]) => void;
}

const AnalysisViewContext = React.createContext<AnalysisViewContextValue | null>(null);

export const AnalysisViewContextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [view, setView] = useQueryParam('view', 'averages');
  const [boardsParam, setBoardsParam] = useQueryParam('boards', DEFAULT_BOARDS.join(','));

  const boards = useMemo(() => {
    const parsed = boardsParam.split(',').filter(Boolean);
    return parsed.length > 0 ? parsed : DEFAULT_BOARDS;
  }, [boardsParam]);

  const setBoards = useCallback((next: string[]) => setBoardsParam(next.join(',')), [setBoardsParam]);

  return (
    <AnalysisViewContext.Provider value={{ view, setView, boards, setBoards }}>{children}</AnalysisViewContext.Provider>
  );
};

/**
 * The (filtered) cards from every board selected in the analysis board picker, in board order.
 */
export const useAnalysisCards = (): Card[] => {
  const { changedCards } = useContext(CubeContext);
  const analysisViewContext = useContext(AnalysisViewContext);
  const boards = analysisViewContext?.boards ?? DEFAULT_BOARDS;

  return useMemo(
    () =>
      Object.keys(changedCards)
        .filter((board) => boards.includes(board) && Array.isArray(changedCards[board]))
        .flatMap((board) => changedCards[board]),
    [changedCards, boards],
  );
};

export default AnalysisViewContext;
