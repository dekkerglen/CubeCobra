import React, { useCallback, useEffect, useState } from 'react';

import Query from '../util/Query';

const ChangelistContext = React.createContext([]);

export const ChangelistContextProvider = ({ cubeID, setOpenCollapse, initialChanges, noSave, ...props }) => {
  const storageKey = `changelist-${cubeID}`;

  const [changes, setChanges] = useState(() => {
    if (initialChanges) {
      return initialChanges;
    } else if (typeof localStorage !== 'undefined' && typeof cubeID !== 'undefined') {
      if (Query.get('updated', false) === 'true') {
        Query.del('updated');
        return [];
      }

      let result;
      try {
        result = JSON.parse(localStorage.getItem(storageKey) || '[]');
      } catch (e) {
        return [];
      }
      if (result.length > 0) {
        if (
          result.some(
            (update) =>
              (update.add && !update.add.details) ||
              (update.remove && !update.remove.details) ||
              (update.replace && !update.replace.every((card) => card.details)),
          )
        ) {
          // Old save format. Reset.
          return [];
        }
      }
      return result;
    } else {
      return [];
    }
  });

  useEffect(() => {
    if (!noSave && typeof localStorage !== 'undefined' && typeof cubeID !== 'undefined') {
      localStorage.setItem(storageKey, JSON.stringify(changes));
    }
  }, [changes]);

  const addChange = useCallback(
    (change) => {
      const highestId = Math.max(changes.map((change) => change.id));
      const newId = !isNaN(highestId) ? highestId + 1 : Math.floor(Math.random() * (1 << 20));
      setChanges([
        ...changes,
        {
          ...change,
          id: newId,
        },
      ]);
      setOpenCollapse('edit');
    },
    [changes],
  );

  const addChanges = useCallback(
    (addedChanges) => {
      const highestId = Math.max(changes.map((change) => change.id));
      let newId = !isNaN(highestId) ? highestId + 1 : Math.floor(Math.random() * (1 << 20));
      const newChanges = [...changes];
      for (const change of addedChanges) {
        newChanges.push({
          ...change,
          id: newId,
        });
        newId += 1;
      }
      setChanges(newChanges);
      setOpenCollapse('edit');
    },
    [changes],
  );

  const removeChange = useCallback((changeId) => {
    setChanges((changes) => changes.filter((change) => change.id !== changeId));
  }, []);
  const value = { changes, setChanges, addChange, addChanges, removeChange };

  return <ChangelistContext.Provider value={value} {...props} />;
};

export default ChangelistContext;
