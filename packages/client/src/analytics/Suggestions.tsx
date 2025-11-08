import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';

import CardType from '@utils/datatypes/Card';
import Button from '../components/base/Button';
import { Card, CardBody, CardHeader } from '../components/base/Card';
import Checkbox from '../components/base/Checkbox';
import { Col, Flexbox, Row } from '../components/base/Layout';
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
  const [maybeOnly, setMaybeOnly] = useState(false);
  const [useImages, setUseImages] = useState(false);

  const [addCards, setAddCards] = React.useState<CardType[]>([]);
  const [addsLoading, setAddsLoading] = React.useState(true);
  const [hasMoreAdds, setHasMoreAdds] = React.useState(true);

  const [cutCards, setCutCards] = React.useState<CardType[]>([]);
  const [cutsLoading, setCutsLoading] = React.useState(true);

  const addsInMaybe = useMemo(
    () =>
      addCards.filter((card) => cube.cards.maybeboard.some((c) => c.details?.oracle_id === card.details?.oracle_id)),
    [addCards, cube],
  );

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

  const loadMoreAdds = useCallback(async () => {
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
    setAddsLoading(false);
  }, [addCards, csrfFetch, cube, filterInput]);

  const cardsToUse = maybeOnly ? addsInMaybe : addCards;
  const reversedCuts = [...cutCards].reverse();

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
              <Text semibold lg>
                Recommended Additions
              </Text>
              <Checkbox checked={maybeOnly} setChecked={setMaybeOnly} label="Show cards from my maybeboard only." />
            </CardHeader>
            {useImages ? (
              <CardBody>
                <Row gutters={2}>
                  {cardsToUse.map((add, index) => (
                    <Col key={add.cardID} xs={6} md={4} xl={3} className="p-1">
                      <ImageSuggestion key={add.cardID} index={index} card={add} cube={cube} />
                    </Col>
                  ))}
                </Row>
                {addsLoading && <CardBody>Loading...</CardBody>}
                {!addsLoading && hasMoreAdds && (
                  <Button onClick={loadMoreAdds} className="my-1" color="primary" block>
                    Load More
                  </Button>
                )}
              </CardBody>
            ) : (
              <Flexbox direction="col" gap="2">
                {cardsToUse.length > 0 &&
                  cardsToUse.map((add, index) => <Suggestion key={add.cardID} index={index} card={add} cube={cube} />)}
                {!addsLoading && cardsToUse.length === 0 && (
                  <CardBody>
                    <em>No results with the given filter.</em>
                  </CardBody>
                )}
                {addsLoading && <CardBody>Loading...</CardBody>}
                {!addsLoading && hasMoreAdds && (
                  <Button onClick={loadMoreAdds} className="my-1" color="primary" block>
                    Load More
                  </Button>
                )}
              </Flexbox>
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
              <CardBody>
                <Row gutters={2}>
                  {reversedCuts.map((add, index) => (
                    <Col key={add.cardID} xs={6} md={4} xl={3} className="p-1">
                      <ImageSuggestion key={add.cardID} index={index} card={add} cube={cube} />
                    </Col>
                  ))}
                </Row>
              </CardBody>
            ) : (
              <Flexbox direction="col" gap="2">
                {cutCards.length > 0 &&
                  reversedCuts.map((add, index) => (
                    <Suggestion key={add.cardID} index={index} card={add} cube={cube} />
                  ))}
                {!cutsLoading && cutCards.length === 0 && (
                  <CardBody>
                    <em>No results with the given filter.</em>
                  </CardBody>
                )}
                {cutsLoading && <CardBody>Loading...</CardBody>}
              </Flexbox>
            )}
          </Card>
        </Col>
      </Row>
    </Flexbox>
  );
};

export default Suggestions;
