import React from 'react';
import PropTypes from 'prop-types';

import { NavLink } from 'reactstrap';

const HeaderCell = ({ label, fieldName, sortConfig, requestSort }) => {
  let icon = '/content/nosort.png';

  if (sortConfig && sortConfig.key === fieldName) {
    if (sortConfig.direction === 'descending') {
      icon = '/content/ascending.png';
    } else {
      icon = '/content/descending.png';
    }
  }

  return (
    <th scope="col">
      <NavLink href="#" onClick={() => requestSort(fieldName)}>
        {label} <img src={icon} className="sortIcon" alt="" />
      </NavLink>
    </th>
  );
};

HeaderCell.propTypes = {
  label: PropTypes.string.isRequired,
  fieldName: PropTypes.string.isRequired,
  sortConfig: PropTypes.shape({
    key: PropTypes.string.isRequired,
    direction: PropTypes.string.isRequired,
  }).isRequired,
  requestSort: PropTypes.string.isRequired,
};

export default HeaderCell;
