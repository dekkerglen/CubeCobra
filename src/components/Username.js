import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { csrfFetch } from 'utils/CSRF';

import { Spinner } from 'reactstrap';
import UserPropType from 'proptypes/UserPropType';

const Username = ({ user, nolink, defaultName }) => {
  const [name, setName] = useState(user.username || defaultName);

  const userId = user.id || user;

  useEffect(() => {
    const getData = async () => {
      if (typeof user === 'string') {
        // Default options are marked with *
        const response = await csrfFetch(`/api/private/userfromid/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId,
          }),
        });
        const val = await response.json();
        return val;
      }

      return user.username;
    };

    getData().then((result) => {
      setName(result.user.username);
    });
  }, [user, userId]);

  if (nolink) {
    return <>{name || <Spinner size="sm" />}</>;
  }

  return (
    <a data-sublink href={`/user/view/${userId}`}>
      {name || <Spinner size="sm" />}
    </a>
  );
};

Username.propTypes = {
  user: PropTypes.oneOfType([PropTypes.string, UserPropType]).isRequired,
  nolink: PropTypes.bool,
  defaultName: PropTypes.string,
};

Username.defaultProps = {
  nolink: false,
  defaultName: 'User',
};

export default Username;
