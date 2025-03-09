import React from 'react';

import classNames from 'classnames';
import { CSVLink } from 'react-csv';

import { fromEntries } from 'utils/Util';

import useSortableData, { SortConfig } from '../hooks/UseSortableData';
import HeaderCell from './HeaderCell';

interface ColumnProps {
  title: string;
  key: string;
  sortable?: boolean;
  heading?: boolean;
  tooltip?: string;
  renderFn?: (value: any, row: any, key: string) => React.ReactNode;
}

interface SortableTableProps {
  data: {
    [key: string]: any;
  }[];
  defaultSortConfig?: SortConfig;
  sortFns?: { [key: string]: (a: any, b: any) => number };
  columnProps: ColumnProps[];
}

export const valueRenderer = (value: any): any => {
  if (Number.isInteger(value)) {
    return value;
  }
  // if it's a string
  if (typeof value === 'string') {
    return value;
  }
  if (isNaN(value)) {
    return '0';
  }
  return value.toFixed(2);
};

export const compareStrings = (a: any, b: any): number => a?.toString?.()?.localeCompare?.(b?.toString?.()) ?? 0;

export const SortableTable: React.FC<SortableTableProps> = ({ data, defaultSortConfig, sortFns, columnProps }) => {
  const { items, requestSort, sortConfig } = useSortableData(data, defaultSortConfig, sortFns);

  //Export CSV data uses same sort as the table shown
  const exportData = items.map((row) =>
    fromEntries(
      Object.entries(row).map(([key, value]) => {
        if (value.exportValue) {
          return [key, value.exportValue];
        }
        return [key, value];
      }),
    ),
  );

  return (
    <>
      <CSVLink data={exportData} filename="export.csv" className="font-medium text-link hover:text-link-active">
        Download CSV
      </CSVLink>
      <div className="overflow-x-auto max-w-full">
        <table className="border border-border rounded-md w-full">
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
                      className={heading ? 'corner' : ''}
                    />
                  );
                }
                if (heading) {
                  return (
                    <th key={key} scope="col" className="min-w-fit">
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
              <tr
                key={`row-${idx}`}
                className={classNames({
                  'bg-bg-accent': idx % 2 === 0,
                  'bg-bg-active': idx % 2 === 1,
                  'border-t border-border': idx > 0,
                })}
              >
                {columnProps.map(({ key, heading, renderFn }) =>
                  heading ? (
                    <th scope="row" className="flex flex-row justify-start px-2" key={key}>
                      {(renderFn ?? valueRenderer)(row[key], row, key)}
                    </th>
                  ) : (
                    <td className="whitespace-nowrap px-2" key={key}>
                      {(renderFn ?? valueRenderer)(row[key], row, key)}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};
