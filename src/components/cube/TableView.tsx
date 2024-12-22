import React, { useContext, useMemo } from 'react';
import { Flexbox } from 'components/base/Layout';
import Text from 'components/base/Text';
import TableViewCardGroup from 'components/card/TableViewCardGroup';
import CubeContext from 'contexts/CubeContext';
import { countGroup, sortDeep } from 'utils/Sort';
import Card from 'datatypes/Card';
import ResponsiveDiv from '../base/ResponsiveDiv';
import classNames from 'classnames';

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
    <div className="my-3">
      <ResponsiveDiv sm>
        <Flexbox direction="row" justify="center" alignItems="start" gap="0" className="w-full" wrap="wrap">
          {sorted.map(([columnLabel, column], index) => (
            <Flexbox
              direction="col"
              justify="center"
              className="table-view-col pr-1"
              alignContent="start"
              alignItems="center"
              key={index}
            >
              <Text semibold md>
                {`${columnLabel}`}
              </Text>
              <Text semibold md>
                {`(${countGroup(column)})`}
              </Text>
              <Flexbox direction="col" gap="1" className="w-full">
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
          ))}
        </Flexbox>
      </ResponsiveDiv>
      <ResponsiveDiv baseVisible sm className="mobile-table-view-container">
        <Flexbox direction="row" gap="1" className="mobile-table-view-row mx-2">
          {sorted.map(([columnLabel, column], index) => (
            <Flexbox
              direction="col"
              justify="start"
              className={classNames('table-view-col', {
                'ps-2': index == 0,
                'pe-2': index == sorted.length - 1,
              })}
              alignContent="start"
              key={index}
              alignItems="center"
            >
              <Text semibold md>
                {`${columnLabel}`}
              </Text>
              <Text semibold md>
                {`(${countGroup(column)})`}
              </Text>
              <Flexbox direction="col" gap="1" className="w-full">
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
          ))}
        </Flexbox>
      </ResponsiveDiv>
    </div>
  );
};

export default TableView;
