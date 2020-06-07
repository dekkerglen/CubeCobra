import React from 'react';
import PropTypes from 'prop-types';

import { NavLink } from 'reactstrap';
import Tooltip from 'components/Tooltip';

const HeaderCell = ({ label, fieldName, sortConfig, requestSort, tooltip }) => {
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
        {tooltip ? (
          <Tooltip text={tooltip}>
            {label} <img src={icon} className="sortIcon" alt="" />
          </Tooltip>
        ) : (
          <>
            {label} <img src={icon} className="sortIcon" alt="" />
          </>
        )}
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
  tooltip: PropTypes.string,
};

export default HeaderCell;
