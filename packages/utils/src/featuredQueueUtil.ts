//Extracted to have functions that can be used in both browser and backend
import Patron, { PatronLevels, PatronStatuses } from './datatypes/Patron';
import { UserRoles } from './datatypes/User';

export const canBeFeatured = (patron: Patron | undefined | null, roles?: UserRoles[] | undefined): boolean => {
  // Admins get every patron perk, regardless of their Patreon status.
  if (roles && roles.includes(UserRoles.ADMIN)) {
    return true;
  }
  return (
    patron !== undefined &&
    patron !== null &&
    patron.status === PatronStatuses.ACTIVE &&
    patron.level > PatronLevels['Cobra Hatchling']
  );
};
