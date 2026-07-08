import React from 'react';

import { ShieldLockIcon } from '@primer/octicons-react';
import classNames from 'classnames';

import { BADGE_BASE_CLASSES } from './PatronBadge';

interface AdminBadgeProps {
  className?: string;
}

// Extra-special badge for Cube Cobra admins — the fanciest treatment of all.
export const AdminBadge: React.FC<AdminBadgeProps> = ({ className }) => (
  <span
    title="Cube Cobra Admin"
    className={classNames(BADGE_BASE_CLASSES, 'patron-badge-admin', className)}
    aria-label="Admin"
  >
    <ShieldLockIcon size={10} />
    Admin
  </span>
);

export default AdminBadge;
