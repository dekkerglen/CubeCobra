import React, { useContext, useMemo } from 'react';

import Button from 'components/base/Button';
import { CardBody } from 'components/base/Card';
import { Flexbox } from 'components/base/Layout';
import Text from 'components/base/Text';
import { SortableTable } from 'components/SortableTable';
import withAutocard from 'components/WithAutocard';
import CubeContext from 'contexts/CubeContext';
import UserContext from 'contexts/UserContext';
import Card from 'datatypes/Card';
import { RecordAnalytic } from 'datatypes/RecordAnalytic';
import { cardName, cardNameLower, cardOracleId, encodeName } from 'utils/cardutil';
import { fromEntries } from 'utils/Util';

const AutocardItem = withAutocard('div');
const renderCardLink = (card: Card) => (
  <AutocardItem className="p-0" key={card.index} card={card}>
    <a href={`/tool/card/${encodeName(card.cardID)}`} target="_blank" rel="noopener noreferrer">
      {cardName(card)}
    </a>
  </AutocardItem>
);
const renderPercent = (val: number) => {
  return <>{parseInt((val * 1000).toString(), 10) / 10}%</>;
};

const compareCardNames = (a: Card, b: Card): number => {
  return cardNameLower(a).localeCompare(cardNameLower(b));
};
interface WinrateAnalyticsProps {
  analyticsData?: RecordAnalytic;
}

const WinrateAnalytics: React.FC<WinrateAnalyticsProps> = ({ analyticsData }) => {
  const { cube, changedCards } = useContext(CubeContext);
  const cards = changedCards.mainboard;
  const user = useContext(UserContext);

  const cardDict = useMemo(
    () => fromEntries(cards.filter((card) => cardOracleId(card)).map((card) => [cardOracleId(card), card])),
    [cards],
  );

  const data = useMemo(() => {
    if (!analyticsData) {
      return [];
    }

    return Object.entries(analyticsData)
      .filter(([oracle]) => cardDict[oracle])
      .map(([oracle, { decks, trophies, matchWins, matchLosses, matchDraws, gameWins, gameLosses, gameDraws }]) => ({
        card: {
          exportValue: cardName(cardDict[oracle]),
          ...cardDict[oracle],
        },
        decks: decks,
        matchCount: matchWins + matchLosses + matchDraws,
        winRate: matchWins / (matchWins + matchLosses + matchDraws),
        drawRate: matchDraws / (matchWins + matchLosses + matchDraws),
        gameCount: gameWins + gameLosses,
        gameWinRate: gameWins / (gameWins + gameLosses + gameDraws),
        trophyCount: trophies,
        trophyRate: trophies / decks,
      }));
  }, [analyticsData, cardDict]);

  const isOwner = user && cube && user.id === cube.owner.id;

  if (!analyticsData) {
    return (
      <CardBody>
        <Flexbox direction="col" gap="2">
          <Text semibold>No analytics data available.</Text>
          {isOwner && (
            <Button block type="link" href={`/cube/records/analytics/${cube.id}`} color="primary">
              Compile Analytics
            </Button>
          )}
        </Flexbox>
      </CardBody>
    );
  }

  return (
    <CardBody>
      <Flexbox direction="col" gap="2">
        {isOwner && (
          <Button block type="link" href={`/cube/records/analytics/${cube.id}`} color="primary">
            Recompile Analytics
          </Button>
        )}
        <SortableTable
          columnProps={[
            {
              key: 'card',
              title: 'Card name',
              heading: true,
              sortable: true,
              renderFn: renderCardLink,
            },
            { key: 'decks', title: 'Deck Count', sortable: true, heading: false },
            { key: 'winRate', title: 'Match Win Percent', sortable: true, heading: false, renderFn: renderPercent },
            { key: 'matchCount', title: 'Match Count', sortable: true, heading: false },
            { key: 'drawRate', title: 'Draw Percent', sortable: true, heading: false, renderFn: renderPercent },
            { key: 'gameWinRate', title: 'Game Win Percent', sortable: true, heading: false, renderFn: renderPercent },
            { key: 'gameCount', title: 'Game Count', sortable: true, heading: false },
            { key: 'trophyCount', title: 'Trophy Count', sortable: true, heading: false },
            { key: 'trophyRate', title: 'Trophy Rate', sortable: true, heading: false, renderFn: renderPercent },
          ]}
          data={data}
          sortFns={{ card: compareCardNames }}
        />
      </Flexbox>
    </CardBody>
  );
};

export default WinrateAnalytics;
