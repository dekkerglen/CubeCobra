import React, { useCallback, useState } from 'react';
import PropTypes from 'prop-types';

import CubeLayout from 'layouts/CubeLayout';
import DeckBuilder from 'components/DeckBuilder';
import { CardBody, Row, Col, Card } from 'reactstrap';

const CubeDeckbuilderPage = ({ cube, cubeID, initialDeck, basics }) => {
  return (
    <CubeLayout cube={cube} cubeID={cubeID} activeLink="playtest">
      <DeckBuilder initialDeck={initialDeck} basics={basics}>
        <Row>
          <Col>
            <Card>
              <CardBody />
            </Card>
          </Col>
          <Col>
            <Card>
              <CardBody />
            </Card>
          </Col>
        </Row>
      </DeckBuilder>
    </CubeLayout>
  );
};

CubeDeckbuilderPage.propTypes = {
  basics: PropTypes.objectOf(PropTypes.object).isRequired,
  cube: PropTypes.shape({}).isRequired,
  cubeID: PropTypes.string.isRequired,
  initialDeck: PropTypes.shape({
    seats: PropTypes.arrayOf(
      PropTypes.shape({
        description: PropTypes.string.isRequired,
        deck: PropTypes.array.isRequired,
        sideboard: PropTypes.array.isRequired,
        username: PropTypes.string.isRequired,
        userid: PropTypes.string,
        bot: PropTypes.array,
        name: PropTypes.string.isRequired,
      }),
    ).isRequired,
  }).isRequired,
};

export default CubeDeckbuilderPage;
