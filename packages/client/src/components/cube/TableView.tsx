import React, { useContext, useMemo } from 'react';

import classNames from 'classnames';

import { countGroup, sortDeep } from '@utils/sorting/Sort';

import Card from '@utils/datatypes/Card';
import CubeContext from 'contexts/CubeContext';
import { Col, Flexbox, NumCols, Row } from 'components/base/Layout';
import ResponsiveDiv from 'components/base/ResponsiveDiv';
import Text from 'components/base/Text';
import TableViewCardGroup from 'components/card/TableViewCardGroup';

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

  const rowWidths: {
    md: NumCols;
    lg: NumCols;
    xl: NumCols;
    xxl: NumCols;
    widthClass: string;
  } = useMemo(() => {
    if (sorted.length === 0) {
      // If there are no cards, return a single column (it doesn't matter).
      return {
        md: 1,
        lg: 1,
        xl: 1,
        xxl: 1,
        widthClass: 'w-full',
      };
    }

    if (sorted.length === 1) {
      // If there is only one column, return a single column, but don't make it too wide
      return {
        md: 1,
        lg: 1,
        xl: 1,
        xxl: 1,
        widthClass: 'md:w-1/2 lg:w-1/4 xl:w-1/5 3xl:w-1/6',
      };
    }

    if (sorted.length === 2) {
      // If there are two columns, return two columns, but don't make them too wide
      return {
        md: 2,
        lg: 2,
        xl: 2,
        xxl: 2,
        widthClass: 'md:w-full lg:w-1/2 xl:w-2/5 3xl:w-1/3',
      };
    }

    if (sorted.length === 3) {
      // If there are three columns, return three columns, but don't make them too wide
      return {
        md: 3,
        lg: 3,
        xl: 3,
        xxl: 3,
        widthClass: 'md:w-full lg:w-3/4 xl:w-3/5 3xl:w-1/2',
      };
    }

    if (sorted.length === 4) {
      // If there are four columns, return four columns, but don't make them too wide
      return {
        md: 4,
        lg: 4,
        xl: 4,
        xxl: 4,
        widthClass: 'md:w-full lg:w-full xl:w-4/5 3xl:w-2/3',
      };
    }

    if (sorted.length === 5) {
      // If there are five columns, return five columns, but don't make them too wide
      return {
        md: 5,
        lg: 5,
        xl: 5,
        xxl: 5,
        widthClass: 'md:w-full lg:w-full xl:w-full 3xl:w-5/6',
      };
    }

    if (sorted.length === 6) {
      return {
        md: 6,
        lg: 6,
        xl: 6,
        xxl: 6,
        widthClass: 'w-full',
      };
    }

    if (sorted.length === 7) {
      return {
        md: 4,
        lg: 7,
        xl: 7,
        xxl: 7,
        widthClass: 'w-full',
      };
    }

    if (sorted.length === 8) {
      return {
        md: 4,
        lg: 8,
        xl: 8,
        xxl: 8,
        widthClass: 'w-full',
      };
    }

    if (sorted.length === 9) {
      return {
        md: 5,
        lg: 9,
        xl: 9,
        xxl: 9,
        widthClass: 'w-full',
      };
    }

    if (sorted.length === 10) {
      return {
        md: 5,
        lg: 10,
        xl: 10,
        xxl: 10,
        widthClass: 'w-full',
      };
    }

    if (sorted.length === 11) {
      return {
        md: 4,
        lg: 11,
        xl: 11,
        xxl: 11,
        widthClass: 'w-full',
      };
    }

    if (sorted.length === 12) {
      return {
        md: 4,
        lg: 6,
        xl: 12,
        xxl: 12,
        widthClass: 'w-full',
      };
    }

    // If there are five columns, return five columns, but don't make them too wide
    return {
      sm: 3,
      md: 4,
      lg: 8,
      xl: 10,
      xxl: 10,
      widthClass: 'w-full',
    };
  }, [sorted]);

  return (
    <div className="my-3">
      <ResponsiveDiv sm>
        <Row
          md={rowWidths.md}
          lg={rowWidths.lg}
          xl={rowWidths.xl}
          xxl={rowWidths.xxl}
          gutters={1}
          className={`${rowWidths.widthClass} mx-auto`}
        >
          {sorted.map(([columnLabel, column], index) => (
            <Col xs={1} key={index}>
              <Flexbox direction="col" justify="center" alignContent="start" alignItems="center" key={index}>
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
            </Col>
          ))}
        </Row>
      </ResponsiveDiv>
      <ResponsiveDiv baseVisible sm className="mobile-table-view-container">
        <Flexbox direction="row" gap="1" className="mobile-table-view-row mx-2">
          {sorted.map(([columnLabel, column], index) => (
            <Flexbox
              direction="col"
              justify="start"
              className={classNames('table-view-col', {
                'ps-2': index === 0,
                'pe-2': index === sorted.length - 1,
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
