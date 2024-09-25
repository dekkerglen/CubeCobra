import React from 'react';

import User from 'datatypes/User';

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

  return (
    <a data-sublink href={`/user/view/${typeof user === 'string' ? user : user.id || user}`}>
      {username}
    </a>
  );
};

export default Username;
