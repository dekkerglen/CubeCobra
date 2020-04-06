import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import LoadingButton from 'components/LoadingButton';
import { csrfFetch } from 'utils/CSRF';
import FilterCollapse from 'components/FilterCollapse';
import Filter from 'utils/Filter';

import {
  Col,
  Row,
  ListGroup,
  ListGroupItem,
  ListGroupItemHeading,
  Card,
  CardBody,
  CardHeader,
} from 'reactstrap';

const Suggestions = ({ cards, cube }) => {
  const [filter, setFilter] = useState([]);
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState([]);
  const [adds, setAdds] = useState([]);

  async function getData(url = '', data = {}) {
    // Default options are marked with *
    const response = await csrfFetch(url, {
      method: 'POST', // *GET, POST, PUT, DELETE, etc.
      headers: {
        'Content-Type': 'application/json',
        // 'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: JSON.stringify(data), // body data type must match "Content-Type" header
    });
    const val = await response.json(); // parses JSON response into native JavaScript objects
    return val.result;
  }

  const updateFilter = (val) => {
    setFilter(val);
    setAdds(suggestions.filter((card) => Filter.filterCard(card, val)).slice(20));
  };

  useEffect(() => {
    getData(`/cube/api/adds/${cube._id}`, { cards: cards.map((card) => card.details.name) }).then((data) => {
      setSuggestions(data);
      setLoading(false);
    });
  }, [cards]);

  return (
    <>
      <h4 className="d-lg-block d-none">Recommender</h4>
      <p>
        View recommended additions and cuts. This data is generated using a machine learning algorithm trained over all cubes on
        Cube Cobra.
      </p>

      <FilterCollapse
        defaultFilterText={'type="creature"'}
        filter={filter}
        setFilter={updateFilter}
        numCards={cards.length}
        isOpen={true}
      />
      <Row>
        <Col xs="12" lg="6">
          <Card>
            <CardHeader>
              <ListGroupItemHeading>Recommended Additions</ListGroupItemHeading>
            </CardHeader>
            <CardBody>
              <ListGroup>
                {loading ? <em>Loading...</em> : adds.map((add) => <ListGroupItem key={add.name}>{add.name}</ListGroupItem>)}
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
                <ListGroupItem>
                  <em>Coming soon!</em>
                </ListGroupItem>
              </ListGroup>
            </CardBody>
          </Card>
        </Col>
      </Row>
    </>
  );
};

Suggestions.propTypes = {
  cube: PropTypes.shape({
    cards: PropTypes.arrayOf(PropTypes.shape({})),
    draft_formats: PropTypes.arrayOf(PropTypes.shape({})),
  }).isRequired,
  cards: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
};

export default Suggestions;
