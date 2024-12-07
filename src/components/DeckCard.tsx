import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Col, Row } from 'components/base/Layout';
import Text from 'components/base/Text';
import Deck from 'datatypes/Deck';
import DeckSeat from 'datatypes/DeckSeat';
import React, { useMemo } from 'react';

import CardGrid from 'components/card/CardGrid';
import CommentsSection from 'components/comments/CommentsSection';
import FoilCardImage from 'components/FoilCardImage';
import Markdown from 'components/Markdown';
import Username from 'components/Username';
import CardType from 'datatypes/Card';
import { sortDeep } from 'utils/Sort';

interface DeckStacksStaticProps {
  piles: number[][][];
  cards: any[];
}

const DeckStacksStatic: React.FC<DeckStacksStaticProps> = ({ piles, cards }) => (
  <CardBody className="pt-0 border-bottom">
    {piles.map((row, index) => (
      <Row key={index} xs={2} md={4} lg={8}>
        {row.map((column, index2) => (
          <Col key={index2} xs={1}>
            <div className="w-full text-center mb-1">
              <b>{column.length > 0 ? column.length : ''}</b>
            </div>
            <div className="stack">
              {column.map((cardIndex, index3) => {
                const card = cards[cardIndex];
                return (
                  <div className="stacked" key={index3}>
                    <a href={card.cardID ? `/tool/card/${card.cardID}` : undefined}>
                      <FoilCardImage card={card} autocard />
                    </a>
                  </div>
                );
              })}
            </div>
          </Col>
        ))}
      </Row>
    ))}
  </CardBody>
);

interface DeckCardProps {
  seat: DeckSeat;
  view?: string;
  deck: Deck;
  seatIndex: string;
}

const DeckCard: React.FC<DeckCardProps> = ({ seat, deck, view = 'deck' }) => {
  const stackedDeck = seat.mainboard.slice();
  const stackedSideboard = seat.sideboard.slice();
  let sbCount = 0;
  for (const col of stackedSideboard[0]) {
    sbCount += col.length;
  }
  if (sbCount <= 0) {
    stackedSideboard.splice(0, stackedSideboard.length);
  }
  // Cut off empty columns at the end.
  let lastFull;
  for (const row of stackedDeck) {
    for (lastFull = row.length - 1; lastFull >= 0; lastFull--) {
      if (row[lastFull] && row[lastFull].length > 0) {
        break;
      }
    }
    const startCut = lastFull + 1;
    row.splice(startCut, row.length - startCut);
  }

  let lastFullSB;
  for (const row of stackedSideboard) {
    for (lastFullSB = row.length - 1; lastFullSB >= 0; lastFullSB--) {
      if (row[lastFullSB] && row[lastFullSB].length > 0) {
        break;
      }
    }
    const startCut = lastFullSB + 1;
    row.splice(startCut, row.length - startCut);
  }

  const sorted = useMemo(() => {
    const deep = sortDeep(
      seat.mainboard.flat(3).map((cardIndex) => deck.cards[cardIndex]),
      true,
      'Unsorted',
      'Color Category',
      'Mana Value Full',
      'Unsorted',
    ) as [string, [string, [string, CardType[]][]][]][];

    return deep
      .map((tuple1) => tuple1[1].map((tuple2) => tuple2[1].map((tuple3) => tuple3[1].map((card) => card))))
      .flat(4);
  }, [deck.cards, seat.mainboard]);

  return (
    <Card>
      <CardHeader>
        <Text semibold lg>
          {seat.name}
        </Text>
        {!seat.bot && (
          <Text md semibold>
            Drafted by {seat.owner ? <Username user={seat.owner} /> : 'Anonymous'}
          </Text>
        )}
      </CardHeader>
      {view === 'picks' && (
        <CardBody>
          {deck.type === 'd' ? (
            <>
              {/* {deck.seats[0].pickorder ? (
                <DecksPickBreakdown deck={deck} seatNumber={parseInt(seatIndex, 10)} />
              ) : (
                <p>There is no draft log associated with this deck.</p>
              )} */}
            </>
          ) : (
            <p>This type of deck does not have a pick breakdown yet.</p>
          )}
        </CardBody>
      )}
      {view === 'deck' && (
        <>
          <DeckStacksStatic piles={stackedDeck} cards={deck.cards} />
          {stackedSideboard && stackedSideboard.length > 0 && (
            <>
              <CardBody className="border-bottom">
                <Text semibold lg>
                  sideboard
                </Text>
              </CardBody>
              <DeckStacksStatic piles={stackedSideboard} cards={deck.cards} />
            </>
          )}
        </>
      )}
      {view === 'visual' && (
        <CardBody>
          <Text semibold lg>
            Mainboard
          </Text>
          <CardGrid cards={sorted} xs={8} />
          {seat.sideboard.flat(2).length > 0 && (
            <>
              <hr className="my-4" />
              <Text semibold md>
                Sideboard
              </Text>
              <CardGrid cards={seat.sideboard.flat(2).map((cardIndex) => deck.cards[cardIndex])} xs={8} />
            </>
          )}
        </CardBody>
      )}
      <CardBody>
        <Markdown markdown={seat.description} />
      </CardBody>
      <div className="border-top">
        <CommentsSection parentType="deck" parent={deck.id} collapse={false} />
      </div>
    </Card>
  );
};

export default DeckCard;
