import { useEffect } from 'react';

// hook that will run only when a component is mounted, and not after subsequent re-renders
// eslint-disable-next-line react-hooks/exhaustive-deps
const useMount = (fun: () => void): void => useEffect(fun, []);

export default useMount;
