import React, { useContext, useMemo } from 'react';

import { cardIndex } from '@utils/cardutil';
import { BoardType } from '@utils/datatypes/Card';
import Card from '@utils/datatypes/Card';
import { countGroup, sortDeep } from '@utils/sorting/Sort';
import classNames from 'classnames';

import { Col, Flexbox, NumCols, Row } from 'components/base/Layout';
import ResponsiveDiv from 'components/base/ResponsiveDiv';
import Text from 'components/base/Text';
import FoilCardImage from 'components/FoilCardImage';
import CubeContext from 'contexts/CubeContext';
import DisplayContext from 'contexts/DisplayContext';

interface CardStacksViewProps {
  cards: Card[];
  formatLabel?: (label: string, count: number) => string;
}

const CardStacksView: React.FC<CardStacksViewProps> = ({ cards, formatLabel }) => {
  const { sortPrimary, sortSecondary, sortTertiary, sortQuaternary, cube, setModalSelection, setModalOpen } =
    useContext(CubeContext);
  const { rightSidebarMode, cubeSidebarExpanded, stacksPerRow } = useContext(DisplayContext);

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

  // Group cards by tertiary sort within each secondary group
  const sortedWithTertiary = useMemo(() => {
    return sorted.map(([columnLabel, groups]) => [
      columnLabel,
      groups.map(([groupLabel, groupCards]) => {
        // Sort the cards within this group by tertiary
        const tertiaryGroups = sortDeep(groupCards, false, sortQuaternary || 'Alphabetical', sortTertiary || 'CMC') as [
          string,
          Card[],
        ][];
        return [groupLabel, tertiaryGroups];
      }),
    ]) as [string, [string, [string, Card[]][]][]][];
  }, [sorted, sortTertiary, sortQuaternary]);

  // Helper function to adjust breakpoint based on open sidebars
  const adjustBreakpoint = useMemo(() => {
    // Count how many sidebars are open (max 2: cube nav + edit/sort)
    let openSidebars = 0;
    if (cubeSidebarExpanded) openSidebars += 1;
    if (rightSidebarMode !== 'none') openSidebars += 1;

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
    if (sortedWithTertiary.length === 0) {
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
  }, [sortedWithTertiary, adjustBreakpoint, sorted.length]);

  const handleCardClick = (card: Card) => {
    setModalSelection({ board: card.board as BoardType, index: cardIndex(card) });
    setModalOpen(true);
  };

  return (
    <div className="my-3">
      <ResponsiveDiv sm>
        <Row
          md={rowWidths.md}
          lg={rowWidths.lg}
          xl={rowWidths.xl}
          xxl={rowWidths.xxl}
          gutters={2}
          className={`${rowWidths.widthClass} mx-auto gap-4`}
        >
          {sortedWithTertiary.map(([columnLabel, column], columnIndex) => (
            <Col xs={1} key={columnIndex}>
              <Flexbox direction="col" justify="center" alignContent="start" alignItems="center">
                <Text semibold lg>
                  {`${columnLabel}`}
                </Text>
                <Text semibold lg>
                  {`(${countGroup(column.flatMap(([, tertiaryGroups]) => tertiaryGroups.flatMap(([, cards]) => cards)))})`}
                </Text>
                <Flexbox direction="col" gap="4" className="w-full">
                  {column.map(([groupLabel, tertiaryGroups], groupIndex) => (
                    <div key={groupIndex} className="w-full">
                      {/* Secondary group label (e.g., "Creature") */}
                      <div className="w-full text-center mb-3">
                        <Text semibold>
                          {`${groupLabel} (${countGroup(tertiaryGroups.flatMap(([, cards]) => cards))})`}
                        </Text>
                      </div>
                      {/* Tertiary groups within this secondary group */}
                      <Row md={stacksPerRow} lg={stacksPerRow} xl={stacksPerRow} xxl={stacksPerRow} gutters={2}>
                        {tertiaryGroups.map(([tertiaryLabel, tertiaryCards], tertiaryIndex) => (
                          <Col xs={1} key={tertiaryIndex}>
                            <div className="w-full text-center mb-1">
                              <Text semibold sm>
                                {formatLabel
                                  ? formatLabel(tertiaryLabel, tertiaryCards.length)
                                  : `${tertiaryLabel} (${tertiaryCards.length})`}
                              </Text>
                            </div>
                            <div className="stack">
                              {tertiaryCards.map((card, cardIdx) => (
                                <div className="stacked" key={cardIdx}>
                                  <div
                                    onClick={() => handleCardClick(card)}
                                    className="cursor-pointer"
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' || e.key === ' ') {
                                        handleCardClick(card);
                                      }
                                    }}
                                  >
                                    <FoilCardImage card={card} autocard />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </Col>
                        ))}
                      </Row>
                    </div>
                  ))}
                </Flexbox>
              </Flexbox>
            </Col>
          ))}
        </Row>
      </ResponsiveDiv>
      <ResponsiveDiv baseVisible sm className="mobile-table-view-container">
        <Flexbox direction="row" gap="4" className="mobile-table-view-row mx-2">
          {sortedWithTertiary.map(([columnLabel, column], columnIndex) => (
            <Flexbox
              direction="col"
              justify="start"
              className={classNames('table-view-col', {
                'ps-2': columnIndex === 0,
                'pe-2': columnIndex === sortedWithTertiary.length - 1,
              })}
              alignContent="start"
              key={columnIndex}
              alignItems="center"
            >
              <Text semibold lg>
                {`${columnLabel}`}
              </Text>
              <Text semibold lg>
                {`(${countGroup(column.flatMap(([, tertiaryGroups]) => tertiaryGroups.flatMap(([, cards]) => cards)))})`}
              </Text>
              <Flexbox direction="col" gap="4" className="w-full">
                {column.map(([groupLabel, tertiaryGroups], groupIndex) => (
                  <div key={groupIndex} className="w-full">
                    {/* Secondary group label (e.g., "Creature") */}
                    <div className="w-full text-center mb-3">
                      <Text semibold>
                        {`${groupLabel} (${countGroup(tertiaryGroups.flatMap(([, cards]) => cards))})`}
                      </Text>
                    </div>
                    {/* Tertiary groups within this secondary group */}
                    <Row xs={stacksPerRow} sm={stacksPerRow} gutters={2}>
                      {tertiaryGroups.map(([tertiaryLabel, tertiaryCards], tertiaryIndex) => (
                        <Col xs={1} key={tertiaryIndex}>
                          <div className="w-full text-center mb-1">
                            <Text semibold sm>
                              {formatLabel
                                ? formatLabel(tertiaryLabel, tertiaryCards.length)
                                : `${tertiaryLabel} (${tertiaryCards.length})`}
                            </Text>
                          </div>
                          <div className="stack">
                            {tertiaryCards.map((card, cardIdx) => (
                              <div className="stacked" key={cardIdx}>
                                <div
                                  onClick={() => handleCardClick(card)}
                                  className="cursor-pointer"
                                  role="button"
                                  tabIndex={0}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      handleCardClick(card);
                                    }
                                  }}
                                >
                                  <FoilCardImage card={card} autocard />
                                </div>
                              </div>
                            ))}
                          </div>
                        </Col>
                      ))}
                    </Row>
                  </div>
                ))}
              </Flexbox>
            </Flexbox>
          ))}
        </Flexbox>
      </ResponsiveDiv>
    </div>
  );
};

export default CardStacksView;
