import React, { useCallback } from 'react';
import PropTypes from 'prop-types';

import { NavLink } from 'reactstrap';
import Tooltip from 'components/Tooltip';

const HeaderCell = ({ label, fieldName, sortConfig, requestSort, tooltip }) => {
  const active = sortConfig && sortConfig.key === fieldName;
  const direction = active ? sortConfig.direction : 'nosort';
  const icon = `/content/${direction}.png`;

  const Wrapper = useCallback(
    ({ children }) =>
      tooltip ? (
        <Tooltip text={tooltip}>
          <div style={{ width: 'min-content' }}>{children}</div>
        </Tooltip>
      ) : (
        <div style={{ width: 'min-content' }}>{children}</div>
      ),
    [tooltip],
  );

  return (
    <th scope="col" className="align-middle">
      <NavLink
        className="p-0 d-flex align-items-center justify-content-start"
        href="#"
        onClick={() => requestSort(fieldName)}
        active
      >
        <Wrapper>{label}</Wrapper>
        <img src={icon} className="sortIcon mr-auto" alt="Toggle sort direction" />
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
  }),
  requestSort: PropTypes.func.isRequired,
  tooltip: PropTypes.string,
};

HeaderCell.defaultProps = {
  tooltip: null,
  sortConfig: null,
};

export default HeaderCell;
