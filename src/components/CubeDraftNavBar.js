import React, { useCallback, useContext, useMemo, useState } from 'react';
import { Card, Collapse, Nav, Navbar } from 'reactstrap';

import PropTypes from 'prop-types';
import { DrafterStatePropType } from 'proptypes/DraftbotPropTypes';

import CustomImageToggler from 'components/CustomImageToggler';
import DeckStacks from 'components/DeckStacks';
import DndProvider from 'components/DndProvider';
import DynamicFlash from 'components/DynamicFlash';
import ErrorBoundary from 'components/ErrorBoundary';
import Pack from 'components/Pack';
import AutocardContext from 'contexts/AutocardContext';
import DraftLocation from 'drafting/DraftLocation';
import { makeSubtitle } from 'utils/Card';

const canDrop = (_, target) => {
  return target.type === DraftLocation.PICKS;
};

const CubeDraftNavBar = ({ drafterState, mainboard, takeCard, moveCard }) => {
  const {
    cards,
    cardsInPack,
    step: { action, amount },
    packNum,
    pickNum,
    numPacks,
  } = drafterState;

  // State for showing loading while waiting for next pick.
  const [picking, setPicking] = useState(null);
  const { hideCard } = useContext(AutocardContext);

  const pack = useMemo(() => cardsInPack.map((cardIndex) => cards[cardIndex]), [cardsInPack, cards]);
  // picks is an array with 1st key C/NC, 2d key CMC, 3d key order
  const picks = useMemo(
    () => mainboard.map((row) => row.map((col) => col.map((cardIndex) => cards[cardIndex]))),
    [mainboard, cards],
  );
  const instructions = useMemo(() => {
    if (action === 'pick') {
      return `Pick ${amount + 1} More Card${amount + 1 > 1 ? 's' : ''}.`;
    }
    if (action === 'trash') {
      return `Trash ${amount + 1} More Card${amount + 1 > 1 ? 's' : ''}.`;
    }
    return null;
  }, [action, amount]);

  const handleMoveCard = useCallback(
    async (source, target) => {
      if (source.equals(target)) return;
      if (source.type === DraftLocation.PACK) {
        if (target.type === DraftLocation.PICKS) {
          setPicking(source.data);
          await takeCard(cardsInPack[source.data], target.data);
          setPicking(null);
        } else {
          console.error("Can't move cards inside pack.");
        }
      } else if (source.type === DraftLocation.PICKS) {
        if (target.type === DraftLocation.PICKS) {
          moveCard({ target: target.data, source: source.data });
        } else {
          console.error("Can't move cards from picks back to pack.");
        }
      }
    },
    [setPicking, takeCard, cardsInPack, moveCard],
  );

  const handleClickCard = useCallback(
    async (event) => {
      event.preventDefault();
      hideCard();
      const cardPackIndex = parseInt(event.currentTarget.getAttribute('data-index'), 10);
      const cardIndex = cardsInPack[cardPackIndex];
      setPicking(cardPackIndex);
      await takeCard(cardIndex);
      setPicking(null);
    },
    [cardsInPack, hideCard, takeCard],
  );
  return (
    <>
      <Navbar expand="xs" light className="usercontrols">
        <Collapse navbar>
          <Nav navbar>
            <CustomImageToggler />
          </Nav>
        </Collapse>
      </Navbar>
      <DynamicFlash />
      <DndProvider>
        {packNum < numPacks && (
          <>
            <ErrorBoundary>
              <Pack
                pack={pack}
                packNumber={packNum + 1}
                pickNumber={pickNum + 1}
                instructions={instructions}
                picking={picking}
                onMoveCard={handleMoveCard}
                onClickCard={handleClickCard}
              />
            </ErrorBoundary>
          </>
        )}
        <ErrorBoundary className="mt-3">
          <Card className="my-3">
            <DeckStacks
              cards={picks}
              title="picks"
              subtitle={makeSubtitle(picks.flat(3))}
              locationType={DraftLocation.PICKS}
              canDrop={canDrop}
              onMoveCard={handleMoveCard}
            />
          </Card>
        </ErrorBoundary>
      </DndProvider>
    </>
  );
};

CubeDraftNavBar.propTypes = {
  drafterState: DrafterStatePropType.isRequired,
  mainboard: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.number.isRequired).isRequired).isRequired)
    .isRequired,
  takeCard: PropTypes.func.isRequired,
  moveCard: PropTypes.func.isRequired,
};

export default CubeDraftNavBar;
