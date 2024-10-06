import classNames from 'classnames';
import React, { ReactNode } from 'react';
import Text from './Text';

interface TableProps {
  headers?: string[];
  rows: { [key: string]: ReactNode }[];
}

const Table: React.FC<TableProps> = ({ headers, rows }) => {
  if (headers) {
    return (
      <table className="border border-border w-full">
        <thead className="bg-bg-active">
          <tr>
            {headers.map((header) => (
              <th key={header} className="p-2 text-left">
                <Text semibold md>
                  {header}
                </Text>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              className={classNames({
                'bg-bg-accent': rowIndex % 2 === 0,
                'bg-bg-active': rowIndex % 2 === 1,
              })}
              key={rowIndex}
            >
              {headers.map((header) => (
                <td key={header} className="whitespace-nowrap p-2">
                  <Text sm>{row[header]}</Text>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <table className="border border-border w-full">
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr
            className={classNames({
              'bg-bg-accent': rowIndex % 2 === 0,
              'bg-bg-active': rowIndex % 2 === 1,
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
  );
};

export default Table;
