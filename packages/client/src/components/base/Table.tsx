import React, { ReactNode } from 'react';

import classNames from 'classnames';

import Text from './Text';

export interface TableProps {
  headers?: string[];
  rows: { [key: string]: ReactNode }[];
  hideOnMobile?: string[];
  // Extra attributes (handlers, className, etc.) merged onto each <tr>. The
  // index matches the row's position in `rows`. Used e.g. to make rows draggable.
  getRowProps?: (rowIndex: number) => React.HTMLAttributes<HTMLTableRowElement>;
  // When true, cells wrap their content instead of forcing the table wider than its
  // container, so the table never introduces horizontal scroll. Off by default to keep
  // the single-line layout every existing table relies on.
  wrapCells?: boolean;
}

const Table: React.FC<TableProps> = ({ headers, rows, hideOnMobile, getRowProps, wrapCells }) => {
  const hiddenSet = new Set(hideOnMobile ?? []);
  const cellHiddenClass = (header: string) => (hiddenSet.has(header) ? 'hidden md:table-cell' : '');
  const wrapClass = wrapCells ? 'whitespace-normal break-words' : 'whitespace-nowrap';
  const wrapperClass = classNames('max-w-full', { 'overflow-x-auto': !wrapCells });

  if (headers) {
    return (
      <div className={wrapperClass}>
        <table className="border border-border w-full">
          <thead className="bg-bg-active/80">
            <tr>
              {headers.map((header) => (
                <th key={header} className={classNames('p-2 text-left', cellHiddenClass(header))}>
                  <Text semibold md>
                    {header}
                  </Text>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => {
              const { className: rowClassName, ...rowRest } = getRowProps?.(rowIndex) ?? {};
              return (
                <tr
                  className={classNames(
                    {
                      'bg-bg-accent/80': rowIndex % 2 === 0,
                      'bg-bg-active/80': rowIndex % 2 === 1,
                    },
                    rowClassName,
                  )}
                  key={rowIndex}
                  {...rowRest}
                >
                  {headers.map((header) => (
                    <td key={header} className={classNames(wrapClass, 'p-2', cellHiddenClass(header))}>
                      <Text sm>{row[header]}</Text>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto max-w-full">
      <table className="border border-border w-full">
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              className={classNames({
                'bg-bg-accent/80': rowIndex % 2 === 0,
                'bg-bg-active/80': rowIndex % 2 === 1,
                'border-t border-border': rowIndex > 0,
              })}
              key={rowIndex}
            >
              {Object.values(row).map((value, index) => (
                <td className="whitespace-nowrap p-1" key={index}>
                  <Text sm>{value}</Text>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Table;
