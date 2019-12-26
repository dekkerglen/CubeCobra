import React, { useCallback, useState } from 'react';

const ChangelistContext = React.createContext([]);

export const ChangelistContextProvider = (props) => {
  const [changes, setChanges] = useState([]);
  const addChange = useCallback((change) => {
    setChanges(changes => {
      const highestId = Math.max(changes.map(change => change.id));
      return [...changes, {
        ...change,
        id: highestId + 1,
      }];
    });
  });
  const removeChange = useCallback((changeId) => {
    setChanges(changes => changes.filter(change => change.id !== changeId));
  });
  const value = { changes, setChanges, addChange, removeChange };

  return (
    <ChangelistContext.Provider value={value} {...props} />
  );
}

export default ChangelistContext;