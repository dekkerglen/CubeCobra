import React, { useCallback } from 'react';
import PropTypes from 'prop-types';

import { DisplayContextProvider } from 'contexts/DisplayContext';
import CubeLayout from 'layouts/CubeLayout';
import MainLayout from 'layouts/MainLayout';
import CubePropType from 'proptypes/CubePropType';
import { sortDeep, countGroup } from 'utils/Sort';
import AutocardListItem from 'components/AutocardListItem';
import CardImage from 'components/CardImage';

import { Row, Col, ListGroup, ListGroupItem, Card, CardHeader, CardBody, Button } from 'reactstrap';

import RenderToRoot from 'utils/RenderToRoot';
import { TagContextProvider } from 'contexts/TagContext';
import { csrfFetch } from 'utils/CSRF';

const SubmitDeckPage = ({ cube, loginCallback }) => {
  const [deck, setDeck] = React.useState([]);

  const primarySort = cube.default_sorts[0] || 'Color Category';
  const secondarySort = cube.default_sorts[1] || 'Types-Multicolor';
  const tertiarySort = cube.default_sorts[2] || 'Mana Value Full';
  const quaternarySort = cube.default_sorts[3] || 'Alphabetical';

  const sorted = sortDeep(cube.cards, true, quaternarySort, primarySort, secondarySort);

  const submitDeck = useCallback(async () => {
    const result = await csrfFetch('/cube/api/submitdeckchecklist', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        deck,
        cubeId: cube._id,
      }),
    });
    const body = await result.json();
    if (body.success === 'true') {
      window.location.href = `/cube/deck/${body.deckid}`;
    } else {
      console.log(body);
    }
  }, [deck, cube]);

  return (
    <MainLayout loginCallback={loginCallback}>
      <CubeLayout cube={cube} activeLink="playtest">
        <DisplayContextProvider cubeID={cube._id}>
          <TagContextProvider
            cubeID={cube._id}
            defaultTagColors={cube.tag_colors}
            defaultShowTagColors={false}
            defaultTags={[]}
          >
            <Card className="my-2">
              <CardHeader>
                <h4>Submit Deck</h4>
              </CardHeader>
              <CardBody>
                <Row className="justify-content-center g-0">
                  {deck.map((index) => (
                    <Col key={index} className="col-1-2">
                      <CardImage
                        card={cube.cards[index]}
                        className="clickable"
                        onClick={() => setDeck(deck.filter((i) => i !== index))}
                      />
                    </Col>
                  ))}
                </Row>
                <Button block color="success" className="mt-3" onClick={submitDeck}>
                  Submit Deck
                </Button>
              </CardBody>
            </Card>
            <h4>Select Cards</h4>
            <Row className="table-view">
              {sorted.map(([columnLabel, column]) => (
                <Col
                  key={columnLabel}
                  md="auto"
                  className="table-col"
                  style={{
                    width: `${100 / Math.min(sorted.length, 9)}%`,
                  }}
                >
                  <h6 className="text-center card-list-heading">
                    {columnLabel}
                    <br />({countGroup(column)})
                  </h6>
                  {column.map(([label, row]) => (
                    <ListGroup className="list-outline">
                      <ListGroupItem tag="div" className="list-group-heading" onClick={() => {}}>
                        {label}
                      </ListGroupItem>
                      {sortDeep(row, true, quaternarySort, tertiarySort).map(([, group]) =>
                        group.map((card, index) => (
                          <AutocardListItem
                            key={card._id || (typeof card.index === 'undefined' ? index : card.index)}
                            card={card}
                            className={index === 0 ? 'cmc-group' : undefined}
                            checkbox
                            checked={deck.includes(card.index)}
                            onClick={() => {
                              console.log(card.index);
                              if (deck.includes(card.index)) {
                                setDeck(deck.filter((idx) => idx !== card.index));
                              } else {
                                setDeck([...deck, card.index]);
                              }
                            }}
                          />
                        )),
                      )}
                    </ListGroup>
                  ))}
                </Col>
              ))}
            </Row>
          </TagContextProvider>
        </DisplayContextProvider>
      </CubeLayout>
    </MainLayout>
  );
};

SubmitDeckPage.propTypes = {
  cube: CubePropType.isRequired,
  loginCallback: PropTypes.string,
};

SubmitDeckPage.defaultProps = {
  loginCallback: '/',
};

export default RenderToRoot(SubmitDeckPage);
