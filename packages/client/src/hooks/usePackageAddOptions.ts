import { Dispatch, SetStateAction } from 'react';

import useLocalStorage from './useLocalStorage';

interface PackageAddOptions {
  autoTag: boolean;
  setAutoTag: Dispatch<SetStateAction<boolean>>;
  useDefaultPrinting: boolean;
  setUseDefaultPrinting: Dispatch<SetStateAction<boolean>>;
}

// Shared by both package-add surfaces (the packages page modal and the cube list
// sidebar) so a preference set in one is honored by the other.
const usePackageAddOptions = (): PackageAddOptions => {
  const [autoTag, setAutoTag] = useLocalStorage<boolean>('packageAddAutoTag', true);
  const [useDefaultPrinting, setUseDefaultPrinting] = useLocalStorage<boolean>('packageAddUseDefaultPrinting', false);

  return { autoTag, setAutoTag, useDefaultPrinting, setUseDefaultPrinting };
};

export default usePackageAddOptions;
