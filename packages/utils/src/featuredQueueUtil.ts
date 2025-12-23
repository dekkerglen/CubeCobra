//Extracted to have functions that can be used in both browser and backend
import Patron, { PatronLevels, PatronStatuses } from './datatypes/Patron';

export const canBeFeatured = (patron: Patron | undefined | null): boolean => {
  return (
    patron !== undefined &&
    patron !== null &&
    patron.status === PatronStatuses.ACTIVE &&
    patron.level > PatronLevels['Cobra Hatchling']
  );
};
