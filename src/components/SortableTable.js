import React, { useMemo, useState } from 'react';

import { Tooltip } from 'reactstrap';

import PagedTable from './PagedTable';

const Header = ({ header, headerProps, active, sorts, setSort }) => {
  const [tooltipOpen, setTooltipOpen] = useState(false);

  const toggleTooltip = () => setTooltipOpen((open) => !open);

  const { tooltip, ...rest } = headerProps;
  const sortable = !!sorts[header];
  const tooltipElement = tooltip && (
    <Tooltip
      placement="top"
      boundariesElement="window"
      trigger="hover"
      target={header.replace(' ', '')}
      isOpen={tooltipOpen}
      toggle={toggleTooltip}
    >
      {tooltip}
    </Tooltip>
  );
  if (sortable) {
    return (
      <th onClick={() => setSort(header)} scope="col" {...rest} style={{ cursor: 'pointer', ...rest.style }}>
        <span id={header.replace(' ', '')}>
          {header}
          {active ? ' ▼' : ''}
        </span>
        {tooltipElement}
      </th>
    );
  } else {
    return (
      <th scope="col" {...rest}>
        <span id={header.replace(' ', '')}>{header}</span>
        {tooltipElement}
      </th>
    );
  }
};

const SortableTable = ({ sorts, defaultSort, headers, data, rowF, ...props }) => {
  const [sort, setSort] = useState(defaultSort);
  const sortKeyF = sorts[sort];
  let sortedData;
  if (Array.isArray(data)) {
    sortedData = data;
    if (sortKeyF) {
      sortedData = useMemo(() => {
        const result = [...data];
        result.sort((x, y) => sortKeyF(x) - sortKeyF(y));
        return result;
      }, [data, sortKeyF]);
    }
  } else {
    sortedData = data[sort];
  }

  const rows = sortedData.map(rowF);
  return (
    <PagedTable rows={rows} {...props}>
      <thead>
        <tr>
          {[...Object.entries(headers)].map(([header, props]) => (
            <Header
              key={header}
              header={header}
              headerProps={props}
              active={sort === header}
              sorts={sorts}
              setSort={setSort}
            />
          ))}
        </tr>
      </thead>
    </PagedTable>
  );
};

export default SortableTable;
