import React from 'react';

import { Flexbox } from './base/Layout';
import Text from './base/Text';

const HEADERS = ['quantity', 'name', 'set', 'number'];

// Each row is one supported line shape. `null` marks a field that may be omitted on that line.
const EXAMPLE_ROWS: (string | null)[][] = [
  ['4', 'Plains', '[M20]', '261'],
  ['4', 'Plains', '[M20]', null],
  ['4', 'Plains', '(M20)', null],
  ['4', 'Plains', null, null],
  ['4x', 'Plains', null, null],
  [null, 'Plains', null, null],
];

const BulkImportFormatHelp: React.FC = () => {
  return (
    <Flexbox direction="col" gap="1">
      <Text sm semibold>
        Type or paste lines for cards in many formats:
      </Text>
      <div className="overflow-x-auto rounded border border-border bg-bg-active p-3">
        <table className="w-full border-separate border-spacing-x-4 border-spacing-y-1 font-mono text-sm">
          <thead>
            <tr>
              {HEADERS.map((header) => (
                <th key={header} className="text-left font-semibold text-text-secondary">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {EXAMPLE_ROWS.map((row, rowIndex) => (
              // eslint-disable-next-line react/no-array-index-key
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) =>
                  cell === null ? (
                    // eslint-disable-next-line react/no-array-index-key
                    <td key={cellIndex} className="italic text-text-secondary">
                      optional
                    </td>
                  ) : (
                    // eslint-disable-next-line react/no-array-index-key
                    <td key={cellIndex} className="text-text">
                      {cell}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Text xs className="text-text-secondary">
        The set can be written in square brackets (<span className="font-mono">[M20]</span>) or parentheses (
        <span className="font-mono">(M20)</span>) — this matches exports from tools like Delver Lens and ManaPools. When
        a set (and optional collector number) is given, that exact printing is added.
      </Text>
    </Flexbox>
  );
};

export default BulkImportFormatHelp;
