import React, { useCallback, useEffect, useState } from 'react';

import Query from '../util/Query';

const ChangelistContext = React.createContext([]);

export const ChangelistContextProvider = ({ cubeID, ...props }) => {
  const storageKey = `changelist-${cubeID}`;

  const [changes, setChanges] = useState(() => {
    if (localStorage && typeof cubeID !== 'undefined') {
      if (Query.get('updated', false) === 'true') {
        Query.del('updated');
        localStorage.setItem(storageKey, '[]');
        return [];
      }
      return JSON.parse(localStorage.getItem(storageKey) || '[]');
    } else {
      return [];
    }
  });

  useEffect(() => {
    if (localStorage && typeof cubeID !== 'undefined') {
      localStorage.setItem(storageKey, JSON.stringify(changes));
    }
  }, [changes]);

  const addChange = useCallback(
    (change) => {
      const highestId = Math.max(changes.map((change) => change.id));
      setChanges([
        ...changes,
        {
          ...change,
          id: highestId + 1,
        },
      ]);
    },
    [changes],
  );
  const removeChange = useCallback((changeId) => {
    setChanges((changes) => changes.filter((change) => change.id !== changeId));
  });
  const value = { changes, setChanges, addChange, removeChange };

  return <ChangelistContext.Provider value={value} {...props} />;
};

export default ChangelistContext;
