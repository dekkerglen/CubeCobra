import React, { useState } from 'react';
import PropTypes from 'prop-types';
import CubePropType from 'proptypes/CubePropType';
import CubePreview from 'components/CubePreview';
import { Col, Row, Card, CardHeader, CardBody, Button, Collapse } from 'reactstrap';

const CubesCard = ({ cubes, title, header, lean, ...props }) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggle = () => setIsOpen(!isOpen);
  const Heading = `h${header?.hLevel ?? 4}`;

  return (
    <Card {...props}>
      <CardHeader style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Heading>{title} </Heading>
        {header && <a href={header.sideLink}>{header.sideText}</a>}
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
      {(!lean || cubes.length > 2) && (
        <CardBody>
          <Button color="success" block onClick={toggle}>
            {isOpen ? 'View Fewer...' : 'View More...'}
          </Button>
        </CardBody>
      )}
    </Card>
  );
};

CubesCard.propTypes = {
  cubes: PropTypes.arrayOf(CubePropType).isRequired,
  title: PropTypes.string.isRequired,
  header: PropTypes.shape({
    sideLink: PropTypes.string,
    sideText: PropTypes.string,
    hLevel: PropTypes.number,
  }),
  lean: PropTypes.bool,
};

CubesCard.defaultProps = {
  header: undefined,
  lean: false,
};

export default CubesCard;
