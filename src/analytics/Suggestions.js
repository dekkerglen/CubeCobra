import React, { useCallback, useContext, useEffect, useMemo } from 'react';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Col,
  Label,
  ListGroup,
  ListGroupItem,
  ListGroupItemHeading,
  Row,
} from 'reactstrap';

import PropTypes from 'prop-types';
import CubePropType from 'proptypes/CubePropType';

import AddToCubeModal from 'components/AddToCubeModal';
import withAutocard from 'components/WithAutocard';
import withModal from 'components/WithModal';
import CubeContext from 'contexts/CubeContext';
import useToggle from 'hooks/UseToggle';
import { encodeName } from 'utils/Card';
import { csrfFetch } from 'utils/CSRF';

const AutocardA = withAutocard('a');
const AddModal = withModal(AutocardA, AddToCubeModal);

function Suggestion({ card, index, cube }) {
  return (
    <ListGroupItem>
      <h6>
        {index + 1}
        {'. '}
        <AddModal
          card={card}
          href={`/tool/card/${encodeName(card.cardID)}`}
          modalProps={{ card: card.details, hideAnalytics: false, cubeContext: cube.id }}
        >
          {card.details.name}
        </AddModal>
      </h6>
    </ListGroupItem>
  );
}

Suggestion.propTypes = {
  card: PropTypes.shape({
    cardID: PropTypes.string.isRequired,
    details: PropTypes.shape({
      image_normal: PropTypes.string.isRequired,
      image_flip: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
    }).isRequired,
  }).isRequired,
  cube: CubePropType.isRequired,
  index: PropTypes.number.isRequired,
};

function ImageSuggestion({ card, cube }) {
  return (
    <AddModal
      card={card}
      href={`/tool/card/${encodeName(card.cardID)}`}
      modalProps={{ card: card.details, hideAnalytics: false, cubeContext: cube.id }}
    >
      <img className="pr-1 w-100" src={card.details.image_normal} />
    </AddModal>
  );
}

ImageSuggestion.propTypes = {
  card: PropTypes.shape({
    cardID: PropTypes.string.isRequired,
    details: PropTypes.shape({
      image_normal: PropTypes.string.isRequired,
      image_flip: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
    }).isRequired,
  }).isRequired,
  cube: CubePropType.isRequired,
  index: PropTypes.number.isRequired,
};

const PAGE_SIZE = 100;

function Suggestions() {
  const { cube, filterInput } = useContext(CubeContext);
  const [maybeOnly, toggleMaybeOnly] = useToggle(false);
  const [useImages, toggleUseImages] = useToggle(false);

  const [addCards, setAddCards] = React.useState([]);
  const [addsLoading, setAddsLoading] = React.useState(true);
  const [hasMoreAdds, setHasMoreAdds] = React.useState(true);

  const [cutCards, setCutCards] = React.useState([]);
  const [cutsLoading, setCutsLoading] = React.useState(true);

  const addsInMaybe = useMemo(
    () => addCards.filter((card) => cube.cards.maybeboard.some((c) => c.details.oracle_id === card.details.oracle_id)),
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
  }, [cube.id, filterInput]);

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
  }, [cube.id, filterInput]);

  const loadMoreAdds = useCallback(async () => {
    setAddsLoading(true);
    const res = await csrfFetch(`/cube/api/adds`, {
      method: 'POST',
      body: JSON.stringify({
        cubeID: cube.id,
        skip: addCards.length,
        limit: PAGE_SIZE,
        filterText: filterInput,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const json = await res.json();
    setAddCards([...addCards, ...json.adds]);
    setAddsLoading(false);
  }, [addCards, cube.id, filterInput]);

  const cardsToUse = maybeOnly ? addsInMaybe : addCards;
  const reversedCuts = [...cutCards].reverse();

  return (
    <>
      <h4 className="d-lg-block d-none">Recommender</h4>
      <p>
        The Cube Cobra Recommender is a machine learning model that powers draftbots, deckbuilding, and can also be used
        to suggest cards to add and identifies cards that are core to your cube. Recommended additions are not just
        cards that are commonly included in similar cubes, but are selected based on what makes your cube unique.
      </p>
      <p>
        The recommended additions can be filtered using scryfall-like syntax, making it a useful tool for searching for
        cards with a meaningful sort for your cube.
      </p>
      <input className="me-2" type="checkbox" checked={useImages} onClick={toggleUseImages} />
      <Label for="toggleImages">Show card images</Label>
      <Row>
        <Col xs={12} lg="6">
          <Card>
            <CardHeader>
              <ListGroupItemHeading>Recommended Additions</ListGroupItemHeading>
              <input className="me-2" type="checkbox" checked={maybeOnly} onClick={toggleMaybeOnly} />
              <Label for="toggleMaybeboard">Show cards from my maybeboard only.</Label>
            </CardHeader>
            {useImages ? (
              <CardBody>
                <Row>
                  {cardsToUse.map((add, index) => (
                    <Col key={add.cardID} xs={12} lg="6" className="p-1">
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
              <ListGroup className="pb-3">
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
              </ListGroup>
            )}
          </Card>
        </Col>
        <Col xs={12} lg="6">
          <Card>
            <CardHeader>
              <ListGroupItemHeading>Core Cards</ListGroupItemHeading>
              <p>
                The algorithm believes these cards are core to your cube. It is a sorted order, with the most core cards
                at the top.
              </p>
            </CardHeader>
            {useImages ? (
              <CardBody>
                <Row>
                  {reversedCuts.map((add, index) => (
                    <Col key={add.cardID} xs={12} lg="6" className="p-1">
                      <ImageSuggestion key={add.cardID} index={index} card={add} cube={cube} />
                    </Col>
                  ))}
                </Row>
              </CardBody>
            ) : (
              <ListGroup className="pb-3">
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
              </ListGroup>
            )}
          </Card>
        </Col>
      </Row>
    </>
  );
}

Suggestions.defaultProps = {
  filter: null,
};

export default Suggestions;
