import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';

import { Card, CardBody, CardHeader, CardTitle, Collapse, Nav, Navbar } from 'reactstrap';

import Draft, { initGrid, createSeen, addSeen, getPicked, getSeen } from 'utils/Draft';
import Location from 'utils/DraftLocation';
import { cmcColumn } from 'utils/Util';
import { cardType, cardIsSpecialZoneType } from 'utils/Card';

import CSRFForm from 'components/CSRFForm';
import CustomImageToggler from 'components/CustomImageToggler';
import DeckStacks from 'components/DeckStacks';
import { DisplayContextProvider } from 'components/DisplayContext';
import DndProvider from 'components/DndProvider';
import CardGrid from 'components/CardGrid';
import DynamicFlash from 'components/DynamicFlash';
import ErrorBoundary from 'components/ErrorBoundary';
import CubeLayout from 'layouts/CubeLayout';
import useToggle from 'hooks/UseToggle';
import { Internal } from 'components/DraftbotBreakdown';

export const subtitle = (cards) => {
  const numCards = cards.length;
  const numLands = cards.filter((card) => cardType(card).includes('land')).length;
  const numNonlands = cards.filter((card) => !cardType(card).includes('land') && !cardIsSpecialZoneType(card)).length;
  const numCreatures = cards.filter((card) => cardType(card).includes('creature')).length;
  const numNonCreatures = numNonlands - numCreatures;
  return (
    `${numCards} card${numCards === 1 ? '' : 's'}: ` +
    `${numLands} land${numLands === 1 ? '' : 's'}, ` +
    `${numNonlands} nonland: ` +
    `${numCreatures} creature${numCreatures === 1 ? '' : 's'}, ` +
    `${numNonCreatures} noncreature${numNonCreatures === 1 ? '' : 's'}`
  );
};

const canDrop = (_, target) => {
  return target.type === Location.PICKS;
};

const showPack = (draft, packNum) => {
  return packNum <= draft.initial_state[0].length;
};

const Pack = ({ pack, packNumber, pickNumber }) => (
  <Card className="mt-3">
    <CardHeader>
      <CardTitle className="mb-0">
        <h4 className="mb-0">
          Pack {packNumber}, Pick {pickNumber}
        </h4>
      </CardTitle>
    </CardHeader>
    <CardBody>
      <CardGrid cardList={pack} colProps={{ className: 'col-md-4', sm: '4', xs: '4' }} cardProps={{ autocard: true }} />
    </CardBody>
  </Card>
);

Pack.propTypes = {
  pack: PropTypes.arrayOf(PropTypes.object).isRequired,
  packNumber: PropTypes.number.isRequired,
  pickNumber: PropTypes.number.isRequired,
};

const GridDraftPage = ({ cube, cubeID, initialDraft }) => {
  console.log(initialDraft);
  return (
    <CubeLayout cube={cube} cubeID={cubeID} activeLink="playtest">
      <DisplayContextProvider>
        <Navbar expand="xs" light className="usercontrols">
          <Collapse navbar>
            <Nav navbar>
              <CustomImageToggler />
            </Nav>
          </Collapse>
        </Navbar>
        <DynamicFlash />
        <DndProvider>
          <ErrorBoundary>
            <Pack pack={pack} packNumber={packNumber} pickNumber={pickNumber} />
          </ErrorBoundary>
          {showBotBreakdown && (
            <ErrorBoundary>
              <Card className="mt-3">
                <CardHeader className="mb-0">
                  <h4 className="mb-0">Draftbot Breakdown</h4>
                </CardHeader>
                <CardBody>
                  <Internal
                    cardsInPack={pack}
                    pack={packNumber - 1}
                    picks={pickNumber - 1}
                    draft={initialDraft}
                    seen={seen}
                    picked={picked}
                  />
                </CardBody>
              </Card>
            </ErrorBoundary>
          )}
          <ErrorBoundary className="mt-3">
            <Card className="mt-3">
              <DeckStacks
                cards={picks}
                title="Picks"
                subtitle={subtitle(picks.flat().flat())}
                locationType={Location.PICKS}
                canDrop={canDrop}
                onMoveCard={handleMoveCard}
              />
            </Card>
          </ErrorBoundary>
        </DndProvider>
      </DisplayContextProvider>
    </CubeLayout>
  );
};

GridDraftPage.propTypes = {
  cube: PropTypes.shape({}).isRequired,
  cubeID: PropTypes.string.isRequired,
  initialDraft: PropTypes.shape({
    _id: PropTypes.string,
    bots: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.string)),
    packs: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.object))).isRequired,
    ratings: PropTypes.objectOf(PropTypes.number),
  }).isRequired,
};

export default GridDraftPage;
