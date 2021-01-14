import { createContext, useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';

import Query from 'utils/Query';

const ChangelistContext = createContext({});

export const ChangelistContextProvider = ({ cubeID, setOpenCollapse, initialChanges, noSave, ...props }) => {
  const [changes, setChanges] = useState(initialChanges || []);
  const [addValue, setAddValue] = useState('');
  const [removeValue, setRemoveValue] = useState('');

  const addInputRef = useRef();
  const removeInputRef = useRef();

  useEffect(() => {
    if (noSave || !cubeID) {
      return;
    }

    if (Query.get('updated', false) === 'true') {
      Query.del('updated');
      setChanges([]);
      return;
    }

    let storedChanges = [];
    const storageKey = `changelist-${cubeID}`;
    try {
      storedChanges = JSON.parse(localStorage.getItem(storageKey) || '[]');
    } catch (e) {
      console.warn(e);
    }
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
  }, [noSave, setOpenCollapse, cubeID]);

  useEffect(() => {
    if (!noSave && typeof localStorage !== 'undefined' && typeof cubeID !== 'undefined') {
      const storageKey = `changelist-${cubeID}`;
      localStorage.setItem(storageKey, JSON.stringify(changes));
    }
  }, [cubeID, noSave, changes]);

  const addChange = useCallback(
    (change) => {
      const highestId = Math.max(changes.map((changeB) => changeB.id));
      const newId = !Number.isNaN(highestId) ? highestId + 1 : Math.floor(Math.random() * 2 ** 20);
      setChanges([
        ...changes,
        {
          ...change,
          id: newId,
        },
      ]);
      setOpenCollapse('edit');
    },
    [setOpenCollapse, changes],
  );

  const addChanges = useCallback(
    (addedChanges) => {
      const highestId = Math.max(changes.map((change) => change.id));
      let newId = !Number.isNaN(highestId) ? highestId + 1 : Math.floor(Math.random() * 2 ** 20);
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
    [setOpenCollapse, changes],
  );

  const removeChange = useCallback((changeId) => {
    setChanges((changesB) => changesB.filter((change) => change.id !== changeId));
  }, []);

  const openEditCollapse = useCallback(() => setOpenCollapse('edit'), [setOpenCollapse]);

  const value = {
    changes,
    addValue,
    setAddValue,
    removeValue,
    setRemoveValue,
    addInputRef,
    removeInputRef,
    setChanges,
    addChange,
    addChanges,
    removeChange,
    openEditCollapse,
  };

  return <ChangelistContext.Provider value={value} {...props} />;
};

ChangelistContextProvider.propTypes = {
  cubeID: PropTypes.string.isRequired,
  setOpenCollapse: PropTypes.func.isRequired,
  initialChanges: PropTypes.arrayOf(PropTypes.shape({})),
  noSave: PropTypes.bool,
};
ChangelistContextProvider.defaultProps = {
  initialChanges: [],
  noSave: false,
};

export default ChangelistContext;
