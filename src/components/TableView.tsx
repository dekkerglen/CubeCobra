import React, { useContext, useMemo } from 'react';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Text from 'components/base/Text';
import TableViewCardGroup from 'components/card/TableViewCardGroup';
import CubeContext from 'contexts/CubeContext';
import { countGroup, sortDeep } from 'utils/Sort';
import Card from 'datatypes/Card';

interface TableViewProps {
  cards: Card[];
}

const TableView: React.FC<TableViewProps> = ({ cards }) => {
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
    <Row xs={8} className="my-3">
      {sorted.map(([columnLabel, column]) => (
        <Col key={columnLabel} xs={1}>
          <Flexbox direction="col" justify="center" className="w-full" alignContent="center" alignItems="center">
            <Text semibold md>
              {`${columnLabel} (${countGroup(column)})`}
            </Text>
            <Flexbox direction="col" gap="2">
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
            </Flexbox>
          </Flexbox>
        </Col>
      ))}
    </Row>
  );
};

export default TableView;
