import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import LoadingButton from 'components/LoadingButton';
import { csrfFetch } from 'utils/CSRF';

import {
  Col,
  Row,
  ListGroup,
  ListGroupItem,
  ListGroupItemHeading,
  Card,
  CardBody,
  CardHeader,
  InputGroup,
  InputGroupAddon,
  InputGroupText,
  Input,
} from 'reactstrap';

const Suggestions = ({ cards, cube }) => {
  const [filterText, setfilterText] = useState('');
  const [filterValid, setFilterValid] = useState(true);
  const [loading, setLoading] = useState(true);
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
    console.log(response);
    const val = await response.json(); // parses JSON response into native JavaScript objects
    console.log(val);
    return val.list;
  }

  useEffect(() => {
    getData(`/cube/api/adds/${cube._id}`, { cards: cards.map((card) => card.details.name) }).then((data) => {
      setAdds(data);
      setLoading(false);
    });
  }, [cards]);

  const applyFilter = (event) => {
    console.log('Apply filter');
  };

  return (
    <>
      <h4 className="d-lg-block d-none">Recommender</h4>
      <p>
        View recommended additions and cuts. This data is generated using machine learning analysis over all cubes on
        Cube Cobra.
      </p>

      <InputGroup className="mb-3">
        <InputGroupAddon addonType="prepend">
          <InputGroupText htmlFor="filterTextInput">Suggest cards that match: </InputGroupText>
        </InputGroupAddon>
        <Input
          type="text"
          id="filterTextInput"
          name="filterTextInput"
          placeholder={'type:"creature"'}
          valid={filterText.length > 0 && filterValid}
          invalid={filterText.length > 0 && !filterValid}
          value={filterText}
          onChange={(event) => setfilterText(event.target.value)}
        />
        <InputGroupAddon addonType="append">
          <LoadingButton color="success" className="square-left" onClick={applyFilter} loading={loading}>
            Apply
          </LoadingButton>
        </InputGroupAddon>
      </InputGroup>
      <Row>
        <Col xs="12" lg="6">
          <Card>
            <CardHeader>
              <ListGroupItemHeading>Recommended Additions</ListGroupItemHeading>
            </CardHeader>
            <CardBody>
              <ListGroup>
                {loading ? <em>Loading...</em> : adds.map((add) => <ListGroupItem key={add[0]}>{add[0] + ': ' + add[1]}</ListGroupItem>)}
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
