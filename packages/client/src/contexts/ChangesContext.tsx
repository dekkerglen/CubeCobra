import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

import Card, { BoardType, Changes } from '@utils/datatypes/Card';
import Cube from '@utils/datatypes/Cube';
import useLocalStorage from 'hooks/useLocalStorage';
import { cardsAreEquivalent } from '@utils/cardutil';

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
  const [version, setVersion] = useState(cube.version);
  const { setOpenCollapse } = useContext(DisplayContext);

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

      if (
        changes.mainboard &&
        ((changes.mainboard.removes || []).length > 0 ||
          (changes.mainboard.swaps || []).length > 0 ||
          (changes.mainboard.edits || []).length > 0)
      ) {
        onlyAdds = false;
      }

      if (
        changes.maybeboard &&
        ((changes.maybeboard.removes || []).length > 0 ||
          (changes.maybeboard.swaps || []).length > 0 ||
          (changes.maybeboard.edits || []).length > 0)
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

      if (changes.mainboard) {
        fixedChanges.mainboard = {
          adds: changes.mainboard.adds,
          removes: [],
          edits: [],
          swaps: [],
        };

        if (cards && (changes.mainboard.removes || []).length > 0) {
          // we go through and see if the index matches the oldCard
          fixedChanges.mainboard.removes = (changes.mainboard.removes || []).filter((remove) => {
            return cardsAreEquivalent(remove.oldCard, cards.mainboard[remove.index]);
          });

          fixedChanges.mainboard.edits = (changes.mainboard.edits || []).filter((edit) => {
            return cardsAreEquivalent(edit.oldCard, cards.mainboard[edit.index]);
          });

          fixedChanges.mainboard.swaps = (changes.mainboard.swaps || []).filter((swap) => {
            return cardsAreEquivalent(swap.oldCard, cards.mainboard[swap.index]);
          });
        }
      }
      if (changes.maybeboard) {
        fixedChanges.maybeboard = {
          adds: changes.maybeboard.adds,
          removes: [],
          edits: [],
          swaps: [],
        };

        if (cards && (changes.maybeboard.removes || []).length > 0) {
          // we go through and see if the index matches the oldCard
          fixedChanges.maybeboard.removes = (changes.maybeboard.removes || []).filter((remove) => {
            return cardsAreEquivalent(remove.oldCard, cards.maybeboard[remove.index]);
          });

          fixedChanges.maybeboard.edits = (changes.maybeboard.edits || []).filter((edit) => {
            return cardsAreEquivalent(edit.oldCard, cards.maybeboard[edit.index]);
          });

          fixedChanges.maybeboard.swaps = (changes.maybeboard.swaps || []).filter((swap) => {
            return cardsAreEquivalent(swap.oldCard, cards.maybeboard[swap.index]);
          });
        }
      }

      // if all the lists are the same length, just update the version
      let equal = true;

      if (changes.mainboard && fixedChanges.mainboard) {
        if (
          (fixedChanges.mainboard.removes || []).length !== (changes.mainboard.removes || []).length ||
          (fixedChanges.mainboard.edits || []).length !== (changes.mainboard.edits || []).length ||
          (fixedChanges.mainboard.swaps || []).length !== (changes.mainboard.swaps || []).length
        ) {
          equal = false;
        }
      }

      if (changes.maybeboard && fixedChanges.maybeboard) {
        if (
          (fixedChanges.maybeboard.removes || []).length !== (changes.maybeboard.removes || []).length ||
          (fixedChanges.maybeboard.edits || []).length !== (changes.maybeboard.edits || []).length ||
          (fixedChanges.maybeboard.swaps || []).length !== (changes.maybeboard.swaps || []).length
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
  }, [cards, changes, clearChanges, setChanges, version]);

  return <ChangesContext.Provider value={value}>{children}</ChangesContext.Provider>;
};

export default ChangesContext;
