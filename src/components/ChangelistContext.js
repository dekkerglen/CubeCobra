import React, { useCallback, useEffect, useRef, useState } from 'react';

import Query from 'utils/Query';

const ChangelistContext = React.createContext({});

export const ChangelistContextProvider = ({ cubeID, setOpenCollapse, initialChanges, noSave, ...props }) => {
  const [changes, setChanges] = useState(initialChanges || []);

  useEffect(() => {
    if (Query.get('updated', false) === 'true') {
      Query.del('updated');
    }

    if (typeof cubeID === 'undefined') {
      return;
    }

    let storedChanges = [];
    const storageKey = `changelist-${cubeID}`;
    try {
      storedChanges = JSON.parse(localStorage.getItem(storageKey) || '[]');
    } catch (e) {}
    if (storedChanges.length > 0) {
      if (
        storedChanges.some(
          (update) =>
            (update.add && !update.add.details) ||
            (update.remove && !update.remove.details) ||
            (update.replace && !update.replace.every((card) => card.details)),
        )
      ) {
        // Old save format. Reset.
        storedChanges = [];
      } else {
        setOpenCollapse('edit');
      }
    }
    setChanges(storedChanges);
  }, [cubeID]);

  useEffect(() => {
    if (!noSave && typeof localStorage !== 'undefined' && typeof cubeID !== 'undefined') {
      const storageKey = `changelist-${cubeID}`;
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
