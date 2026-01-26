import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';

import CardType from '@utils/datatypes/Card';

import { Card, CardBody, CardHeader } from '../components/base/Card';
import Checkbox from '../components/base/Checkbox';
import { Col, Flexbox, Row } from '../components/base/Layout';
import Pagination from '../components/base/Pagination';
import RadioButtonGroup from '../components/base/RadioButtonGroup';
import Text from '../components/base/Text';
import { CSRFContext } from '../contexts/CSRFContext';
import CubeContext from '../contexts/CubeContext';
import FilterContext from '../contexts/FilterContext';
import ImageSuggestion from './ImageSuggestion';
import Suggestion from './Suggestion';

const PAGE_SIZE = 100;

const Suggestions: React.FC = () => {
  const { csrfFetch } = useContext(CSRFContext);
  const { filterInput } = useContext(FilterContext);
  const { cube } = useContext(CubeContext);
  const [maybeboardFilter, setMaybeboardFilter] = useState<'no' | 'yes' | 'exclusively'>('no');
  const [useImages, setUseImages] = useState(false);

  const [addCards, setAddCards] = React.useState<CardType[]>([]);
  const [addsLoading, setAddsLoading] = React.useState(true);
  const [hasMoreAdds, setHasMoreAdds] = React.useState(true);
  const [addsPage, setAddsPage] = React.useState(0);

  const [cutCards, setCutCards] = React.useState<CardType[]>([]);
  const [cutsLoading, setCutsLoading] = React.useState(true);
  const [cutsPage, setCutsPage] = React.useState(0);

  const maybeboardOracleIds = useMemo(
    () => new Set(cube.cards.maybeboard.map((c) => c.details?.oracle_id).filter(Boolean)),
    [cube],
  );

  const filteredAddCards = useMemo(() => {
    if (maybeboardFilter === 'exclusively') {
      // Only show cards that are in maybeboard
      return addCards.filter((card) => maybeboardOracleIds.has(card.details?.oracle_id));
    } else if (maybeboardFilter === 'no') {
      // Exclude cards that are in maybeboard
      return addCards.filter((card) => !maybeboardOracleIds.has(card.details?.oracle_id));
    } else {
      // Show all cards (yes)
      return addCards;
    }
  }, [addCards, maybeboardFilter, maybeboardOracleIds]);

  useEffect(() => {
    const run = async () => {
      setAddsLoading(true);
      setAddCards([]);
      const res = await csrfFetch(`/cube/api/adds`, {
        method: 'POST',
        body: JSON.stringify({
          cubeID: cube.id,
          skip: 0,
          limit: PAGE_SIZE,
          filterText: filterInput,
          printingPreference: cube.defaultPrinting,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const json = await res.json();
      setAddCards(json.adds);
      setHasMoreAdds(json.hasMoreAdds);
      setAddsLoading(false);
    };
    run();
  }, [csrfFetch, cube, filterInput]);

  useEffect(() => {
    const run = async () => {
      setCutsLoading(true);
      setCutCards([]);
      const res = await csrfFetch(`/cube/api/cuts`, {
        method: 'POST',
        body: JSON.stringify({
          cubeID: cube.id,
          skip: 0,
          limit: PAGE_SIZE,
          filterText: filterInput,
          printingPreference: cube.defaultPrinting,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const json = await res.json();
      setCutCards(json.cuts);
      setCutsLoading(false);
    };
    run();
  }, [csrfFetch, cube, filterInput]);

  const fetchMoreAdds = useCallback(async () => {
    setAddsLoading(true);
    const res = await csrfFetch(`/cube/api/adds`, {
      method: 'POST',
      body: JSON.stringify({
        cubeID: cube.id,
        skip: addCards.length,
        limit: PAGE_SIZE,
        filterText: filterInput,
        printingPreference: cube.defaultPrinting,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const json = await res.json();
    setAddCards([...addCards, ...json.adds]);
    setHasMoreAdds(json.hasMoreAdds);
    setAddsPage(addsPage + 1);
    setAddsLoading(false);
  }, [addCards, csrfFetch, cube, filterInput, addsPage]);

  const cardsToUse = filteredAddCards;
  const addsPageCount = Math.ceil(cardsToUse.length / PAGE_SIZE);
  const reversedCuts = [...cutCards].reverse();
  const cutsPageCount = Math.ceil(reversedCuts.length / PAGE_SIZE);

  return (
    <Flexbox direction="col" gap="2" className="m-2">
      <Text>
        The Cube Cobra Recommender is a machine learning model that powers draftbots, deckbuilding, and can also be used
        to suggest cards to add and identifies cards that are core to your cube. Recommended additions are not just
        cards that are commonly included in similar cubes, but are selected based on what makes your cube unique.
      </Text>
      <Text>
        The recommended additions can be filtered using scryfall-like syntax, making it a useful tool for searching for
        cards with a meaningful sort for your cube.
      </Text>
      <Checkbox checked={useImages} setChecked={setUseImages} label="Show card images" />
      <Row>
        <Col xs={12} lg={6}>
          <Card>
            <CardHeader>
              <Flexbox direction="col" gap="2">
                <Text semibold lg>
                  Recommended Additions
                </Text>
                <RadioButtonGroup
                  label="Include suggestions from maybeboard?"
                  selected={maybeboardFilter}
                  setSelected={(value) => setMaybeboardFilter(value as 'no' | 'yes' | 'exclusively')}
                  options={[
                    { value: 'no', label: "No - don't show cards from maybeboard" },
                    { value: 'yes', label: 'Yes - show all suggestions including maybeboard' },
                    { value: 'exclusively', label: 'Exclusively - only show cards from maybeboard' },
                  ]}
                />
              </Flexbox>
            </CardHeader>
            {useImages ? (
              <>
                <CardBody>
                  <Row gutters={2}>
                    {cardsToUse.slice(addsPage * PAGE_SIZE, (addsPage + 1) * PAGE_SIZE).map((add, index) => (
                      <Col key={add.cardID} xs={6} md={4} xl={3} className="p-1">
                        <ImageSuggestion key={add.cardID} index={addsPage * PAGE_SIZE + index} card={add} cube={cube} />
                      </Col>
                    ))}
                  </Row>
                  {addsLoading && <div className="text-center py-3">Loading...</div>}
                </CardBody>
                {cardsToUse.length > 0 && (
                  <Flexbox direction="row" justify="end" className="p-2">
                    <Pagination
                      count={addsPageCount}
                      active={addsPage}
                      hasMore={hasMoreAdds}
                      onClick={async (newPage) => {
                        if (newPage >= addsPageCount) {
                          await fetchMoreAdds();
                        } else {
                          setAddsPage(newPage);
                        }
                      }}
                      loading={addsLoading}
                    />
                  </Flexbox>
                )}
              </>
            ) : (
              <>
                <Flexbox direction="col" gap="2">
                  {cardsToUse.length > 0 &&
                    cardsToUse
                      .slice(addsPage * PAGE_SIZE, (addsPage + 1) * PAGE_SIZE)
                      .map((add, index) => (
                        <Suggestion key={add.cardID} index={addsPage * PAGE_SIZE + index} card={add} cube={cube} />
                      ))}
                  {!addsLoading && cardsToUse.length === 0 && (
                    <CardBody>
                      <em>No results with the given filter.</em>
                    </CardBody>
                  )}
                  {addsLoading && <CardBody>Loading...</CardBody>}
                </Flexbox>
                {cardsToUse.length > 0 && (
                  <Flexbox direction="row" justify="end" className="p-2">
                    <Pagination
                      count={addsPageCount}
                      active={addsPage}
                      hasMore={hasMoreAdds}
                      onClick={async (newPage) => {
                        if (newPage >= addsPageCount) {
                          await fetchMoreAdds();
                        } else {
                          setAddsPage(newPage);
                        }
                      }}
                      loading={addsLoading}
                    />
                  </Flexbox>
                )}
              </>
            )}
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card>
            <CardHeader>
              <Flexbox direction="col" gap="2">
                <Text semibold lg>
                  Core Cards
                </Text>
                <Text md>
                  The algorithm believes these cards are core to your cube. It is a sorted order, with the most core
                  cards at the top.
                </Text>
              </Flexbox>
            </CardHeader>
            {useImages ? (
              <>
                <CardBody>
                  <Row gutters={2}>
                    {reversedCuts.slice(cutsPage * PAGE_SIZE, (cutsPage + 1) * PAGE_SIZE).map((add, index) => (
                      <Col key={add.cardID} xs={6} md={4} xl={3} className="p-1">
                        <ImageSuggestion key={add.cardID} index={cutsPage * PAGE_SIZE + index} card={add} cube={cube} />
                      </Col>
                    ))}
                  </Row>
                  {cutsLoading && <div className="text-center py-3">Loading...</div>}
                </CardBody>
                {reversedCuts.length > 0 && cutsPageCount > 1 && (
                  <Flexbox direction="row" justify="end" className="p-2">
                    <Pagination
                      count={cutsPageCount}
                      active={cutsPage}
                      onClick={(newPage) => setCutsPage(newPage)}
                      loading={cutsLoading}
                    />
                  </Flexbox>
                )}
              </>
            ) : (
              <>
                <Flexbox direction="col" gap="2">
                  {cutCards.length > 0 &&
                    reversedCuts
                      .slice(cutsPage * PAGE_SIZE, (cutsPage + 1) * PAGE_SIZE)
                      .map((add, index) => (
                        <Suggestion key={add.cardID} index={cutsPage * PAGE_SIZE + index} card={add} cube={cube} />
                      ))}
                  {!cutsLoading && cutCards.length === 0 && (
                    <CardBody>
                      <em>No results with the given filter.</em>
                    </CardBody>
                  )}
                  {cutsLoading && <CardBody>Loading...</CardBody>}
                </Flexbox>
                {reversedCuts.length > 0 && cutsPageCount > 1 && (
                  <Flexbox direction="row" justify="end" className="p-2">
                    <Pagination
                      count={cutsPageCount}
                      active={cutsPage}
                      onClick={(newPage) => setCutsPage(newPage)}
                      loading={cutsLoading}
                    />
                  </Flexbox>
                )}
              </>
            )}
          </Card>
        </Col>
      </Row>
    </Flexbox>
  );
};

export default Suggestions;
