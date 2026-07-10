import React, { ReactNode } from 'react';

import { InfoIcon } from '@primer/octicons-react';
import classNames from 'classnames';

import Text from './Text';
import Tooltip from './Tooltip';

export interface TableProps {
  headers?: string[];
  rows: { [key: string]: ReactNode }[];
  hideOnMobile?: string[];
  // Optional explanatory tooltips keyed by header. When present, an info icon is
  // rendered next to that header and shows the text on hover.
  headerTooltips?: { [key: string]: string };
  // Extra attributes (handlers, className, etc.) merged onto each <tr>. The
  // index matches the row's position in `rows`. Used e.g. to make rows draggable.
  getRowProps?: (rowIndex: number) => React.HTMLAttributes<HTMLTableRowElement>;
  // When true, cells wrap their content instead of forcing the table wider than its
  // container, so the table never introduces horizontal scroll. Off by default to keep
  // the single-line layout every existing table relies on.
  wrapCells?: boolean;
}

const Table: React.FC<TableProps> = ({ headers, rows, hideOnMobile, headerTooltips, getRowProps, wrapCells }) => {
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
              {headers.map((header) => {
                const tooltip = headerTooltips?.[header];
                return (
                  <th key={header} className={classNames('p-2 text-left', cellHiddenClass(header))}>
                    <span className="inline-flex items-center gap-1">
                      <Text semibold md>
                        {header}
                      </Text>
                      {tooltip && (
                        <Tooltip
                          text={tooltip}
                          wrapperTag="span"
                          className="inline-flex items-center text-text-secondary"
                        >
                          <InfoIcon size={14} />
                        </Tooltip>
                      )}
                    </span>
                  </th>
                );
              })}
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
