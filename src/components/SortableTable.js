import React from 'react';
import PropTypes from 'prop-types';
import { Table } from 'reactstrap';

import HeaderCell from 'components/HeaderCell';
import useSortableData from 'hooks/UseSortableData';

export const valueRenderer = (value) => {
  if (!Number.isFinite(value) || Number.isInteger(value)) {
    return value;
  }
  return value.toFixed(2);
};

export const compareStrings = (a, b) => a?.toString?.()?.localeCompare?.(b?.toString?.());

export const SortableTable = ({ data, defaultSortConfig, sortFns, columnProps, totalRow, totalCol, ...props }) => {
  const { items, requestSort, sortConfig } = useSortableData(data, defaultSortConfig, sortFns);

  return (
    <Table bordered responsive className="mt-lg-3" {...props}>
      <thead>
        <tr>
          {columnProps.map(({ title, key, sortable, heading, tooltip }) => {
            if (sortable) {
              return (
                <HeaderCell
                  key={key}
                  fieldName={key}
                  label={title}
                  sortConfig={sortConfig}
                  requestSort={requestSort}
                  tooltip={tooltip}
                />
              );
            }
            if (heading) {
              return (
                <th key={key} scope="col">
                  {title}
                </th>
              );
            }
            return <td key={key}>{title}</td>;
          })}
        </tr>
      </thead>
      <tbody className="breakdown">
        {items.map((row, idx) => (
          <tr key={`row-${idx}` /* eslint-disable-line react/no-array-index-key */}>
            {columnProps.map(({ key, heading, renderFn }) =>
              heading ? (
                <th scope="col" key={key}>
                  {(renderFn ?? valueRenderer)(row[key])}
                </th>
              ) : (
                <td key={key}>{(renderFn ?? valueRenderer)(row[key])}</td>
              ),
            )}
          </tr>
        ))}
      </tbody>
    </Table>
  );
};

SortableTable.propTypes = {
  data: PropTypes.arrayOf(PropTypes.shape({}).isRequired).isRequired,
  defaultSortConfig: PropTypes.shape({
    key: PropTypes.string.isRequired,
    direction: PropTypes.oneOf(['ascending', 'descending']).isRequired,
  }),
  sortFns: PropTypes.shape({}),
  columnProps: PropTypes.arrayOf(
    PropTypes.shape({
      title: PropTypes.string.isRequired,
      key: PropTypes.string.isRequired,
      sortable: PropTypes.bool,
      heading: PropTypes.bool,
      tooltip: PropTypes.string,
      renderFunc: PropTypes.func,
    }).isRequired,
  ).isRequired,
  totalRow: PropTypes.bool,
  totalCol: PropTypes.bool,
};
SortableTable.defaultProps = {
  defaultSortConfig: null,
  sortFns: {},
  totalRow: false,
  totalCol: false,
};

export default SortableTable;
