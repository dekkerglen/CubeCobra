import { useMemo, useState } from 'react';

const useNewID = () => {
  const [lastID, setLastID] = useState(1000);
  return useMemo(() => {
    setLastID(lastID + 1);
    return `id-${lastID}`;
  }, []);
};

export default useNewID;
