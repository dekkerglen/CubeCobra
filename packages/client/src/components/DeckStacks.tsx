import React, { useState } from 'react';

import { useDndMonitor } from '@dnd-kit/core';
import Card from '@utils/datatypes/Card';

import Location, { location } from '../drafting/DraftLocation';
import { CardBody, CardHeader } from './base/Card';
import { Flexbox, NumCols, Row } from './base/Layout';
import Text from './base/Text';
import CardStack from './card/CardStack';
import DraggableCard from './DraggableCard';

interface DeckStacksProps {
  cards: Card[][][];
  title: string;
  subtitle?: React.ReactNode;
  locationType: location;
  onClickCard?: (card: Card) => void;
  xs?: NumCols;
  md?: NumCols;
  lg?: NumCols;
}

interface DragOverState {
  row: number;
  col: number;
  index: number;
}

const DeckStacks: React.FC<DeckStacksProps> = ({ cards, title, subtitle, locationType, xs, md, lg }) => {
  const [dragOverPosition, setDragOverPosition] = useState<DragOverState | null>(null);
  const [draggedFrom, setDraggedFrom] = useState<DragOverState | null>(null);

  useDndMonitor({
    onDragStart(event) {
      const sourceData = event.active.data.current as Location;
      if (sourceData && sourceData.type === locationType) {
        setDraggedFrom({
          row: sourceData.row,
          col: sourceData.col,
          index: sourceData.index,
        });
      }
    },
    onDragOver(event) {
      const { active, over } = event;

      if (!over || !active.data.current) {
        setDragOverPosition(null);
        return;
      }

      const sourceData = active.data.current as Location;
      const targetData = over.data.current as Location;

      // Only track if we're in the same location type
      if (sourceData.type !== locationType || targetData.type !== locationType) {
        setDragOverPosition(null);
        return;
      }

      // Set the position we're hovering over
      setDragOverPosition({
        row: targetData.row,
        col: targetData.col,
        index: targetData.index,
      });
    },
    onDragEnd() {
      setDragOverPosition(null);
      setDraggedFrom(null);
    },
    onDragCancel() {
      setDragOverPosition(null);
      setDraggedFrom(null);
    },
  });

  const getCardShift = (cardRow: number, cardCol: number, cardIndex: number): number => {
    if (!dragOverPosition || !draggedFrom) return 0;

    // Only shift cards in the same column
    if (cardRow !== dragOverPosition.row || cardCol !== dragOverPosition.col) return 0;

    const isSameStack = cardRow === draggedFrom.row && cardCol === draggedFrom.col;

    if (isSameStack) {
      // Moving within the same stack
      if (draggedFrom.index < dragOverPosition.index) {
        // Dragging down: shift cards between source and target
        if (cardIndex > draggedFrom.index && cardIndex <= dragOverPosition.index) {
          return -1; // Shift up
        }
      } else if (draggedFrom.index > dragOverPosition.index) {
        // Dragging up: shift cards between target and source
        if (cardIndex >= dragOverPosition.index && cardIndex < draggedFrom.index) {
          return 1; // Shift down
        }
      }
    } else {
      // Moving from different stack: shift cards at and after target down
      if (cardIndex >= dragOverPosition.index) {
        return 1; // Shift down
      }
    }

    return 0;
  };

  return (
    <>
      <CardHeader>
        <Flexbox direction="row" alignItems="end" justify="between" wrap="wrap">
          <Text semibold lg>
            {title}
          </Text>
          <Text semibold md>
            {subtitle}
          </Text>
        </Flexbox>
      </CardHeader>
      <CardBody className="pt-0">
        {cards.map((row, index) => (
          <Row key={`row-${index}`} xs={xs} md={md} lg={lg}>
            {row.map((column, index2) => (
              <CardStack
                key={`row-${index}-col-${index2}`}
                location={new Location(locationType, index, index2, column.length)}
              >
                {column.map((card, index3) => {
                  const shift = getCardShift(index, index2, index3);
                  const isBeingDragged =
                    draggedFrom?.row === index && draggedFrom?.col === index2 && draggedFrom?.index === index3;

                  return (
                    <div
                      className="stacked"
                      key={`row-${index}-col-${index2}-card-${index3}`}
                      style={{
                        transform: shift !== 0 ? `translateY(${shift * 10}%)` : undefined,
                        opacity: isBeingDragged ? 0.3 : 1,
                      }}
                    >
                      <DraggableCard location={new Location(locationType, index, index2, index3)} card={card} />
                    </div>
                  );
                })}
              </CardStack>
            ))}
          </Row>
        ))}
      </CardBody>
    </>
  );
};

export default DeckStacks;
