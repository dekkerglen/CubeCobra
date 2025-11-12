import React from 'react';

import { cardName } from '@utils/cardutil';
import CardType from '@utils/datatypes/Card';
import classNames from 'classnames';

import Button from 'components/base/Button';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import Collapse from 'components/base/Collapse';
import { Col, Flexbox, Row } from 'components/base/Layout';
import { ListGroup, ListGroupItem } from 'components/base/ListGroup';
import Text from 'components/base/Text';
import AutocardListItem from 'components/card/AutocardListItem';
import withCardModal from 'components/modals/WithCardModal';
import CubeContext from 'contexts/CubeContext';
import RotoDraftContext, { getBaseCardName } from 'contexts/RotoDraftContext';
import usePollGoogleSheet from 'hooks/usePollGoogleSheet';

const CardModalLink = withCardModal(AutocardListItem);

const RotisserieDraftPanel = () => {
  const { changedCards } = React.useContext(CubeContext);
  usePollGoogleSheet();
  const { url, rotoInfo, assignCardIndexes } = React.useContext(RotoDraftContext);
  const [hidden, setHidden] = React.useState(true);

  // Assign card indexes when roto info changes
  React.useEffect(() => {
    if (rotoInfo.picks && Object.keys(rotoInfo.picks).length > 0) {
      assignCardIndexes(changedCards.mainboard);
    }
  }, [rotoInfo.picks, changedCards.mainboard, assignCardIndexes]);

  if (url === '' || Object.keys(rotoInfo.picksByPlayer).length === 0 || Object.keys(rotoInfo.players).length === 0) {
    return null;
  }

  const cardsByPlayer: Record<string, { card: CardType | undefined; pick: any }[]> = {};
  Object.keys(rotoInfo.picksByPlayer).forEach((player) => {
    const picks = rotoInfo.picksByPlayer[player];
    const cardPicks = picks.map((pick) => {
      const baseCardName = getBaseCardName(pick.cardName);
      // mapping is keyed by overall pick number
      const cardIndex = rotoInfo.cardIndexMapping?.[pick.overallPickNumber];

      let cardForPick: CardType | undefined;
      if (cardIndex !== undefined) {
        // Use the specific card index from the mapping
        cardForPick = changedCards.mainboard.find((card) => card.index === cardIndex);
      } else {
        // Fallback to the old method if mapping not available
        cardForPick = changedCards.mainboard.find((card) => cardName(card).toLowerCase() === baseCardName);
      }

      return { card: cardForPick, pick };
    });

    cardsByPlayer[player] = cardPicks;
  });

  return (
    <Card className="w-full mt-2">
      <CardHeader>
        <Flexbox justify="between" className="w-full">
          <Text semibold md>
            Rotisserie Draft Picks
          </Text>
          {hidden ? (
            <Button color="primary" onClick={() => setHidden(false)}>
              Show Picks
            </Button>
          ) : (
            <Button color="primary" onClick={() => setHidden(true)}>
              Hide Picks
            </Button>
          )}
        </Flexbox>
      </CardHeader>
      <Collapse isOpen={!hidden} className="transition-all duration-300">
        <CardBody>
          {Object.keys(rotoInfo.players).length !== 0 && (
            <Row md={4} lg={8} xl={8} xxl={8} gutters={1} className={`w-full mx-auto`}>
              {Object.values(rotoInfo.players).map((player) => {
                const cardsForPlayer = cardsByPlayer[player.index];
                return (
                  <Col xs={1} key={player.index}>
                    <ListGroup key={player.name}>
                      <ListGroupItem heading>{player.name}</ListGroupItem>
                      {cardsForPlayer.map((cardData, index) => {
                        if (!cardData.card) return null;

                        return (
                          <CardModalLink
                            key={index}
                            card={cardData.card}
                            altClick={() => {
                              window.open(`/tool/card/${cardData.card!.cardID}`);
                            }}
                            last={index === cardsForPlayer.length - 1}
                            cardCopyIndex={cardData.pick.cardCopyIndex}
                            className={classNames({
                              'border-border-secondary border-t': index === 0,
                            })}
                            modalprops={{
                              card: cardData.card,
                            }}
                          />
                        );
                      })}
                    </ListGroup>
                  </Col>
                );
              })}
            </Row>
          )}
        </CardBody>
      </Collapse>
    </Card>
  );
};

export default RotisserieDraftPanel;
