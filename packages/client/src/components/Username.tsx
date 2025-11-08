import React from 'react';

import Link from 'components/base/Link';
import User from '@utils/datatypes/User';

interface UsernameProps {
  user?: string | User;
  nolink?: boolean;
}

const Username: React.FC<UsernameProps> = ({ user, nolink = false }) => {
  if (!user) {
    return 'Anonymous';
  }

  const username = (user as User).username ?? 'User';
  if (nolink) {
    return username;
  }

  return <Link href={`/user/view/${typeof user === 'string' ? user : user.id || user}`}>{username}</Link>;
};

export default Username;
