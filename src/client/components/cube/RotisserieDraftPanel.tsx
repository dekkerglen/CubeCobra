import classNames from 'classnames';
import { Flexbox } from 'components/base/Layout';
import { ListGroup, ListGroupItem } from 'components/base/ListGroup';
import Text from 'components/base/Text';
import AutocardListItem from 'components/card/AutocardListItem';
import withCardModal from 'components/modals/WithCardModal';
import CubeContext from 'contexts/CubeContext';
import RotoDraftContext, { getBaseCardName } from 'contexts/RotoDraftContext';
import Card from 'datatypes/Card';
import usePollGoogleSheet from 'hooks/usePollGoogleSheet';
import React from 'react';

const CardModalLink = withCardModal(AutocardListItem);

const RotisserieDraftPanel = () => {
  const { unfilteredChangedCards } = React.useContext(CubeContext);
  usePollGoogleSheet();
  const { url, rotoInfo } = React.useContext(RotoDraftContext);

  if (url === "" || Object.keys(rotoInfo.picksByPlayer).length === 0 || Object.keys(rotoInfo.players).length === 0) return;

  const cardsByPlayer: Record<string, (Card | undefined)[]> = {};
  Object.keys(rotoInfo.picksByPlayer).forEach((player) => {
    const picks = rotoInfo.picksByPlayer[player];
    const cardPicks = picks.map((pick) => {
      const cardForPick = unfilteredChangedCards.mainboard.find((card) => card.name ? card.name.toLowerCase() === getBaseCardName(pick.cardName) : undefined);
      return cardForPick;
    })

    cardsByPlayer[player] = cardPicks;
  });

  return (
    <Flexbox direction="col" gap="1" className="w-full">
      <Text semibold md>
        Rotisserie Draft
      </Text>
      {Object.keys(rotoInfo.players).length !== 0 && (
        <Flexbox direction="row" gap="0" className="w-full">
          {Object.values(rotoInfo.players).map((player) => {
            const cardsForPlayer = cardsByPlayer[player.index];
            return (
              <ListGroup key={player.name}>
                <ListGroupItem heading>{player.name}</ListGroupItem>
                {cardsForPlayer.map((card, index) => {
                  if (!card) return null;

                  return <CardModalLink
                    key={card.cardID}
                    card={card}
                    altClick={() => {
                      window.open(`/tool/card/${card.cardID}`);
                    }}
                    last={index === cardsForPlayer.length - 1}
                    className={classNames({
                      'border-border-secondary border-t': index === 0,
                    })}
                    modalprops={{
                      card,
                    }}
                  />
                })}
              </ListGroup>
            )
          })}
        </Flexbox>
      )}
    </Flexbox>
  )
}

export default RotisserieDraftPanel;