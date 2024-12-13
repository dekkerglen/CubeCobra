import React, { useContext, useMemo } from 'react';
import { Col, Row } from 'components/base/Layout';
import Text from 'components/base/Text';
import TableViewCardGroup from 'components/card/TableViewCardGroup';
import CubeContext from 'contexts/CubeContext';
import { countGroup, sortDeep } from 'utils/Sort';
import Card from 'datatypes/Card';

interface TableViewProps {
  cards: Card[];
  className?: string;
}

const TableView: React.FC<TableViewProps> = ({ cards, className }) => {
  const { sortPrimary, sortSecondary, sortTertiary, sortQuaternary, cube } = useContext(CubeContext);

  const sorted = useMemo(
    () =>
      sortDeep(
        cards,
        cube.showUnsorted || false,
        sortQuaternary || 'Alphabetical',
        sortPrimary || 'Color Category',
        sortSecondary || 'Types-Multicolor',
      ) as unknown as [string, [string, Card[]][]][],
    [cards, cube.showUnsorted, sortQuaternary, sortPrimary, sortSecondary],
  );

  return (
    <div className={`table-view-container${className ? ` ${className}` : ''}`}>
      <Row>
        {sorted.map(([columnLabel, column]) => (
          <Col key={columnLabel} className="table-col">
            <Text semibold sm>
              {columnLabel}
              <br />({countGroup(column)})
            </Text>
            {column.map(([label, row]) => (
              <TableViewCardGroup
                key={label}
                heading={`${label} (${countGroup(row)})`}
                cards={row}
                sort={sortTertiary || 'CMC'}
                orderedSort={sortQuaternary || 'Alphabetical'}
                showOther={cube.showUnsorted}
              />
            ))}
          </Col>
        ))}
      </Row>
    </div>
  );
};

export default TableView;
