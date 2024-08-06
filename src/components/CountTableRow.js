import React from 'react';

import PropTypes from 'prop-types';

const CountTableRow = ({ label, value }) => {
  if (value[1] === 0) {
    return (
      <tr>
        <td>{label}:</td>
        <td>
          0%<span className="percent">0 / 0</span>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td>{label}:</td>
      <td>
        {Math.round((value[0] / value[1]) * 10000) / 100}%<span className="percent">{`${value[0]} / ${value[1]}`}</span>
      </td>
    </tr>
  );
};

CountTableRow.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.arrayOf(PropTypes.number).isRequired,
};

export default CountTableRow;
