import React from 'react';

import User from 'datatypes/User';
import Link from './base/Link';

interface UsernameProps {
  user: string | User;
  nolink?: boolean;
}

const Username: React.FC<UsernameProps> = ({ user, nolink = false }) => {
  const username = (user as User).username ?? 'User';
  if (nolink) {
    return username;
  }

  if (!user) {
    return 'Anonymous';
  }

  return <Link href={`/user/view/${typeof user === 'string' ? user : user.id || user}`}>{username}</Link>;
};

export default Username;
