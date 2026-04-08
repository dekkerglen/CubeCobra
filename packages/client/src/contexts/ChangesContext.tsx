import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

import { cardsAreEquivalent } from '@utils/cardutil';
import Card, {
  BoardChanges,
  BoardType,
  Changes,
  CubeCardEdit,
  CubeCardRemove,
  CubeCardSwap,
} from '@utils/datatypes/Card';
import Cube from '@utils/datatypes/Cube';

import useLocalStorage from 'hooks/useLocalStorage';

import DisplayContext from './DisplayContext';

export interface ChangesContextValue {
  version: number;
  setVersion: (version: number) => void;
  changes: Changes;
  brokenChanges?: Changes;
  setChanges: (changes: Changes) => void;
  clearChanges: () => void;
  versionMismatch: boolean;
  fixedChanges?: Changes;
}

const ChangesContext = createContext<ChangesContextValue>({
  version: 0,
  setVersion: function (): void {
    throw new Error('Function not implemented.');
  },
  changes: {},
  setChanges: function (): void {
    throw new Error('Function not implemented.');
  },
  clearChanges: function (): void {
    throw new Error('Function not implemented.');
  },
  versionMismatch: false,
});

interface ChangesContextProvider {
  children: React.ReactNode;
  cube: Cube;
  cards?: Record<BoardType, Card[]>;
}

export const ChangesContextProvider: React.FC<ChangesContextProvider> = ({ children, cube, cards }) => {
  const [changes, updateChanges] = useLocalStorage<Changes>(`cubecobra-changes-${cube.id}`, {});
  const [version, setVersionState] = useState(cube.version);
  const { setOpenCollapse } = useContext(DisplayContext);

  // Wrapper to ensure version updates are captured
  const setVersion = useCallback((newVersion: number) => {
    setVersionState(newVersion);
  }, []);

  const setChanges = useCallback(
    (newChanges: Changes) => {
      newChanges.version = version;
      updateChanges(newChanges);
      setOpenCollapse('edit');
    },
    [version, updateChanges, setOpenCollapse],
  );

  const clearChanges = useCallback(() => {
    updateChanges({});
  }, [updateChanges]);

  const value = useMemo(() => {
    let versionMismatch = false;

    // if changes is not an empty object, and the version of the changes does not match the cube version
    if (Object.keys(changes).length > 0 && changes.version !== version) {
      // if the local changes are only adds, this is actually fine, and we can just bump the version
      let onlyAdds = true;

      const mainboard = changes.mainboard as BoardChanges | undefined;
      if (
        mainboard &&
        ((mainboard.removes || []).length > 0 ||
          (mainboard.swaps || []).length > 0 ||
          (mainboard.edits || []).length > 0)
      ) {
        onlyAdds = false;
      }

      const maybeboard = changes.maybeboard as BoardChanges | undefined;
      if (
        maybeboard &&
        ((maybeboard.removes || []).length > 0 ||
          (maybeboard.swaps || []).length > 0 ||
          (maybeboard.edits || []).length > 0)
      ) {
        onlyAdds = false;
      }

      if (onlyAdds) {
        const newChanges = { ...changes };
        newChanges.version = version;
        setChanges(newChanges);
      } else {
        versionMismatch = true;
      }
    }

    if (versionMismatch) {
      // attempt to create a fixedChanges object
      const fixedChanges: Changes = {};

      const mainboard = changes.mainboard as BoardChanges | undefined;
      if (mainboard) {
        fixedChanges.mainboard = {
          adds: mainboard.adds,
          removes: [],
          edits: [],
          swaps: [],
        };

        if (cards && (mainboard.removes || []).length > 0) {
          // we go through and see if the index matches the oldCard
          fixedChanges.mainboard.removes = (mainboard.removes || []).filter((remove: CubeCardRemove) => {
            return cardsAreEquivalent(remove.oldCard, cards.mainboard[remove.index]);
          });

          fixedChanges.mainboard.edits = (mainboard.edits || []).filter((edit: CubeCardEdit) => {
            return cardsAreEquivalent(edit.oldCard, cards.mainboard[edit.index]);
          });

          fixedChanges.mainboard.swaps = (mainboard.swaps || []).filter((swap: CubeCardSwap) => {
            return cardsAreEquivalent(swap.oldCard, cards.mainboard[swap.index]);
          });
        }
      }
      const maybeboard = changes.maybeboard as BoardChanges | undefined;
      if (maybeboard) {
        fixedChanges.maybeboard = {
          adds: maybeboard.adds,
          removes: [],
          edits: [],
          swaps: [],
        };

        if (cards && (maybeboard.removes || []).length > 0) {
          // we go through and see if the index matches the oldCard
          fixedChanges.maybeboard.removes = (maybeboard.removes || []).filter((remove: CubeCardRemove) => {
            return cardsAreEquivalent(remove.oldCard, cards.maybeboard[remove.index]);
          });

          fixedChanges.maybeboard.edits = (maybeboard.edits || []).filter((edit: CubeCardEdit) => {
            return cardsAreEquivalent(edit.oldCard, cards.maybeboard[edit.index]);
          });

          fixedChanges.maybeboard.swaps = (maybeboard.swaps || []).filter((swap: CubeCardSwap) => {
            return cardsAreEquivalent(swap.oldCard, cards.maybeboard[swap.index]);
          });
        }
      }

      // if all the lists are the same length, just update the version
      let equal = true;

      const changesMainboard = changes.mainboard as BoardChanges | undefined;
      const fixedMainboard = fixedChanges.mainboard as BoardChanges | undefined;
      if (changesMainboard && fixedMainboard) {
        if (
          (fixedMainboard.removes || []).length !== (changesMainboard.removes || []).length ||
          (fixedMainboard.edits || []).length !== (changesMainboard.edits || []).length ||
          (fixedMainboard.swaps || []).length !== (changesMainboard.swaps || []).length
        ) {
          equal = false;
        }
      }

      const changesMaybeboard = changes.maybeboard as BoardChanges | undefined;
      const fixedMaybeboard = fixedChanges.maybeboard as BoardChanges | undefined;
      if (changesMaybeboard && fixedMaybeboard) {
        if (
          (fixedMaybeboard.removes || []).length !== (changesMaybeboard.removes || []).length ||
          (fixedMaybeboard.edits || []).length !== (changesMaybeboard.edits || []).length ||
          (fixedMaybeboard.swaps || []).length !== (changesMaybeboard.swaps || []).length
        ) {
          equal = false;
        }
      }

      if (equal) {
        setChanges(fixedChanges);
      }

      return {
        version,
        setVersion,
        changes: {},
        brokenChanges: changes,
        setChanges,
        clearChanges,
        fixedChanges,
        versionMismatch,
      };
    }

    return {
      version,
      setVersion,
      changes,
      setChanges,
      clearChanges,
      versionMismatch,
    };
  }, [cards, changes, clearChanges, setChanges, setVersion, version]);

  return <ChangesContext.Provider value={value}>{children}</ChangesContext.Provider>;
};

export default ChangesContext;
