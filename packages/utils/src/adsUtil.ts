// Shared rule for who browses ad-free. Patrons support the site directly, and
// admins get every patron perk, so both skip ads. Kept in utils so every ad
// surface applies the same rule.
import { UserRoles } from './datatypes/User';

export const isAdFree = (roles: UserRoles[] | undefined | null): boolean =>
  Array.isArray(roles) && (roles.includes(UserRoles.PATRON) || roles.includes(UserRoles.ADMIN));
