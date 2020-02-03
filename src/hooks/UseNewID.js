import { useMemo } from 'react';

let lastID = 1000;

const useNewID = () => {
  return useMemo(() => {
    lastID += 1;
    return `id-${lastID}`;
  }, []);
};

export default useNewID;
