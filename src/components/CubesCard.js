import React, { useState } from 'react';
import PropTypes from 'prop-types';
import CubePreview from 'components/CubePreview';
import { Col, Row, Card, CardHeader, CardBody, Button, Collapse } from 'reactstrap';

const CubesCard = ({ cubes, title }) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggle = () => setIsOpen(!isOpen);

  return (
    <Card className="mt-4">
      <CardHeader>
        <h4>{title}</h4>
      </CardHeader>
      <Row noGutters>
        {cubes.slice(0, 2).map((cube) => (
          <Col key={cube._id} lg={6} md={6} sm={12} xs={12}>
            <CubePreview cube={cube} />
          </Col>
        ))}
      </Row>

      <Collapse isOpen={isOpen}>
        <Row noGutters>
          {cubes.slice(2).map((cube) => (
            <Col key={cube._id} lg={6} md={6} sm={12} xs={12}>
              <CubePreview cube={cube} />
            </Col>
          ))}
        </Row>
      </Collapse>
      <CardBody>
        <Button color="success" block onClick={toggle}>
          {isOpen ? 'View Fewer...' : 'View More...'}
        </Button>
      </CardBody>
    </Card>
  );
};

CubesCard.propTypes = {
  cubes: PropTypes.arrayOf(
    PropTypes.shape({
      _id: PropTypes.string.isRequired,
      shortId: PropTypes.string,
      urlAlias: PropTypes.string,
      name: PropTypes.string.isRequired,
      card_count: PropTypes.number.isRequired,
      type: PropTypes.string.isRequired,
      overrideCategory: PropTypes.bool,
      categoryOverride: PropTypes.string,
      categoryPrefixes: PropTypes.arrayOf(PropTypes.string),
      image_name: PropTypes.string.isRequired,
      image_artist: PropTypes.string.isRequired,
      image_uri: PropTypes.string.isRequired,
      owner: PropTypes.string.isRequired,
      owner_name: PropTypes.string.isRequired,
    }),
  ).isRequired,
  title: PropTypes.string.isRequired,
};

export default CubesCard;
