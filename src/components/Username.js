import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { csrfFetch } from 'utils/CSRF';

import { Spinner } from 'reactstrap';

const Username = ({ userId, defaultName, nolink }) => {
  const [name, setName] = useState(defaultName);

  useEffect(() => {
    const getData = async () => {
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
    };

    getData().then((result) => {
      setName(result.user.Username);
    });
  }, [userId]);

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
  userId: PropTypes.string.isRequired,
  defaultName: PropTypes.string,
  nolink: PropTypes.bool,
};

Username.defaultProps = {
  defaultName: null,
  nolink: false,
};

export default Username;
