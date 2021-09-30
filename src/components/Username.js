import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { csrfFetch } from 'utils/CSRF';

const CardPackage = ({ userId, defaultName }) => {
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
      console.log(result);
      setName(result.user.username);
    });
  }, [userId]);

  return <a href={`/user/view/${userId}`}>{name}</a>;
};

CardPackage.propTypes = {
  userId: PropTypes.string.isRequired,
  defaultName: PropTypes.string,
};

CardPackage.defaultProps = {
  defaultName: 'Cube Cobra User',
};

export default CardPackage;
