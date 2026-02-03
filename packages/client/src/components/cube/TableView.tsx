import React, { useContext, useMemo } from 'react';

import Card from '@utils/datatypes/Card';
import { countGroup, sortDeep } from '@utils/sorting/Sort';
import classNames from 'classnames';

import { Col, Flexbox, NumCols, Row } from 'components/base/Layout';
import ResponsiveDiv from 'components/base/ResponsiveDiv';
import Text from 'components/base/Text';
import TableViewCardGroup from 'components/card/TableViewCardGroup';
import CubeContext from 'contexts/CubeContext';
import DisplayContext from 'contexts/DisplayContext';
import useLocalStorage from 'hooks/useLocalStorage';

interface TableViewProps {
  cards: Card[];
}

const TableView: React.FC<TableViewProps> = ({ cards }) => {
  const { sortPrimary, sortSecondary, sortTertiary, sortQuaternary, cube } = useContext(CubeContext);
  const { rightSidebarMode, cubeSidebarExpanded } = useContext(DisplayContext);

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

  // Helper function to adjust breakpoint based on open sidebars
  const adjustBreakpoint = useMemo(() => {
    // Count how many sidebars are open (max 2: cube nav + edit/sort)
    let openSidebars = 0;
    if (cubeSidebarExpanded) openSidebars++;
    if (rightSidebarMode !== 'none') openSidebars++;

    console.log('TableView: cubeSidebarExpanded=', cubeSidebarExpanded, 'rightSidebarMode=', rightSidebarMode, 'openSidebars=', openSidebars);

    // Return a function that takes a breakpoint config and reduces column counts
    return (config: { md: NumCols; lg: NumCols; xl: NumCols; xxl: NumCols }) => {
      let result;
      
      // Helper to clamp column count
      const clamp = (val: NumCols, max: number): NumCols => {
        return Math.min(val, max) as NumCols;
      };

      if (openSidebars === 0) {
        result = config;
      } else if (openSidebars === 1) {
        // With 1 sidebar: reduce max columns and shift breakpoints down
        result = {
          md: clamp(config.md, 6),
          lg: clamp(config.md, 6),
          xl: clamp(config.lg, 10),
          xxl: clamp(config.xl, 12),
        };
      } else {
        // With 2 sidebars: further reduce max columns and shift more aggressively
        result = {
          md: clamp(config.md, 4),
          lg: clamp(config.md, 4),
          xl: clamp(config.md, 6),
          xxl: clamp(config.lg, 8),
        };
      }
      console.log('adjustBreakpoint: input=', config, 'output=', result, 'openSidebars=', openSidebars);
      return result;
    };
  }, [cubeSidebarExpanded, rightSidebarMode]);

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
        ...adjustBreakpoint({
          md: 1,
          lg: 1,
          xl: 1,
          xxl: 1,
        }),
        widthClass: 'w-full',
      };
    }

    if (sorted.length === 1) {
      // If there is only one column, return a single column, but don't make it too wide
      return {
        ...adjustBreakpoint({
          md: 1,
          lg: 1,
          xl: 1,
          xxl: 1,
        }),
        widthClass: 'md:w-1/2 lg:w-1/4 xl:w-1/5 3xl:w-1/6',
      };
    }

    if (sorted.length === 2) {
      // If there are two columns, return two columns, but don't make them too wide
      return {
        ...adjustBreakpoint({
          md: 2,
          lg: 2,
          xl: 2,
          xxl: 2,
        }),
        widthClass: 'md:w-full lg:w-1/2 xl:w-2/5 3xl:w-1/3',
      };
    }

    if (sorted.length === 3) {
      // If there are three columns, return three columns, but don't make them too wide
      return {
        ...adjustBreakpoint({
          md: 3,
          lg: 3,
          xl: 3,
          xxl: 3,
        }),
        widthClass: 'md:w-full lg:w-3/4 xl:w-3/5 3xl:w-1/2',
      };
    }

    if (sorted.length === 4) {
      // If there are four columns, return four columns, but don't make them too wide
      return {
        ...adjustBreakpoint({
          md: 4,
          lg: 4,
          xl: 4,
          xxl: 4,
        }),
        widthClass: 'md:w-full lg:w-full xl:w-4/5 3xl:w-2/3',
      };
    }

    if (sorted.length === 5) {
      // If there are five columns, return five columns, but don't make them too wide
      return {
        ...adjustBreakpoint({
          md: 5,
          lg: 5,
          xl: 5,
          xxl: 5,
        }),
        widthClass: 'md:w-full lg:w-full xl:w-full 3xl:w-5/6',
      };
    }

    if (sorted.length === 6) {
      return {
        ...adjustBreakpoint({
          md: 6,
          lg: 6,
          xl: 6,
          xxl: 6,
        }),
        widthClass: 'w-full',
      };
    }

    if (sorted.length === 7) {
      return {
        ...adjustBreakpoint({
          md: 4,
          lg: 7,
          xl: 7,
          xxl: 7,
        }),
        widthClass: 'w-full',
      };
    }

    if (sorted.length === 8) {
      return {
        ...adjustBreakpoint({
          md: 4,
          lg: 8,
          xl: 8,
          xxl: 8,
        }),
        widthClass: 'w-full',
      };
    }

    if (sorted.length === 9) {
      return {
        ...adjustBreakpoint({
          md: 5,
          lg: 9,
          xl: 9,
          xxl: 9,
        }),
        widthClass: 'w-full',
      };
    }

    if (sorted.length === 10) {
      return {
        ...adjustBreakpoint({
          md: 5,
          lg: 10,
          xl: 10,
          xxl: 10,
        }),
        widthClass: 'w-full',
      };
    }

    if (sorted.length === 11) {
      return {
        ...adjustBreakpoint({
          md: 4,
          lg: 11,
          xl: 11,
          xxl: 11,
        }),
        widthClass: 'w-full',
      };
    }

    if (sorted.length === 12) {
      return {
        ...adjustBreakpoint({
          md: 4,
          lg: 6,
          xl: 12,
          xxl: 12,
        }),
        widthClass: 'w-full',
      };
    }

    // If there are five columns, return five columns, but don't make them too wide
    return {
      ...adjustBreakpoint({
        md: 4,
        lg: 8,
        xl: 10,
        xxl: 10,
      }),
      widthClass: 'w-full',
    };
  }, [sorted, adjustBreakpoint]);

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
