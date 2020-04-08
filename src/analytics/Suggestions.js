import React from 'react';
import PropTypes from 'prop-types';
import withAutocard from 'components/WithAutocard';
import { encodeName } from 'utils/Card';
import PagedList from 'components/PagedList';

import { Col, Row, ListGroup, ListGroupItem, ListGroupItemHeading, Card, CardBody, CardHeader } from 'reactstrap';

const AutocardA = withAutocard('a');

const Suggestion = ({ card, index }) => {
  return (
    <ListGroupItem>
      <h6>
        {index + 1}
        {'. '}
        <AutocardA
          front={card.details.image_normal}
          back={card.details.image_flip || undefined}
          href={`/tool/card/${encodeName(card.cardID)}`}
        >
          {card.details.name}
        </AutocardA>
      </h6>
    </ListGroupItem>
  );
};

Suggestion.propTypes = {
  card: PropTypes.shape({
    cardID: PropTypes.string.isRequired,
    details: PropTypes.shape({
      image_normal: PropTypes.string.isRequired,
      image_flip: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
    }).isRequired,
  }).isRequired,
  index: PropTypes.number.isRequired,
};

const Suggestions = ({ adds, cuts, loading }) => {
  console.log(adds);

  return (
    <>
      <h4 className="d-lg-block d-none">Recommender</h4>
      <p>
        View recommended additions and cuts. This data is generated using a machine learning algorithm trained over all
        cubes on Cube Cobra.
      </p>
      <Row>
        <Col xs="12" lg="6">
          <Card>
            <CardHeader>
              <ListGroupItemHeading>Recommended Additions</ListGroupItemHeading>
            </CardHeader>
            <CardBody>
              <ListGroup>
                {loading && <em>Loading...</em>}
                {!loading &&
                  (adds.length > 0 ? (
                    <PagedList
                      pageSize={20}
                      rows={adds.slice(0).map((add, index) => (
                        <Suggestion key={add.cardID} index={index} card={add} />
                      ))}
                    />
                  ) : (
                    <em>No results with the given filter.</em>
                  ))}
              </ListGroup>
            </CardBody>
          </Card>
        </Col>
        <Col xs="12" lg="6">
          <Card>
            <CardHeader>
              <ListGroupItemHeading>Recommended Cuts</ListGroupItemHeading>
            </CardHeader>
            <CardBody>
              <ListGroup>
                {loading && <em>Loading...</em>}
                {!loading &&
                  (cuts.length > 0 ? (
                    <PagedList
                      pageSize={20}
                      rows={cuts.slice(0).map((add, index) => (
                        <Suggestion key={add.cardID} index={index} card={add} />
                      ))}
                    />
                  ) : (
                    <em>No results with the given filter.</em>
                  ))}
              </ListGroup>
            </CardBody>
          </Card>
        </Col>
      </Row>
    </>
  );
};

Suggestions.propTypes = {
  adds: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  cuts: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  loading: PropTypes.bool.isRequired,
};

export default Suggestions;
