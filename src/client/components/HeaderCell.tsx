import React from 'react';

import { SortConfig } from '../hooks/UseSortableData';
import { Flexbox } from './base/Layout';
import Text from './base/Text';

interface HeaderCellProps {
  label: string;
  fieldName: string;
  sortConfig?: SortConfig | null;
  requestSort: (fieldName: string) => void;
  [key: string]: any; // To allow any additional props
}

const HeaderCell: React.FC<HeaderCellProps> = ({ label, fieldName, sortConfig, requestSort, tooltip, ...props }) => {
  const active = sortConfig && sortConfig.key === fieldName;
  const direction = active ? sortConfig.direction : 'nosort';
  const icon = `/content/${direction}.png`;

  return (
    <th scope="col" className="min-w-fit align-middle" {...props}>
      <Flexbox
        className="hover:cursor-pointer select-none hover:bg-bg-active p-2"
        direction="row"
        justify="between"
        alignItems="center"
        gap="2"
        onClick={() => requestSort(fieldName)}
      >
        <Text className="whitespace-nowrap">{label}</Text>
        <img src={icon} className="h-4 me-auto" alt="Toggle sort direction" />
      </Flexbox>
    </th>
  );
};

export default HeaderCell;
