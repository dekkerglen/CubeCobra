import React from 'react';
import PropTypes from 'prop-types';

import { Card, CardHeader, Collapse, CardBody } from 'reactstrap';

import useToggle from 'hooks/UseToggle';

const Accordion = ({ defaultExpand, children, title }) => {
  const [expanded, toggle] = useToggle(defaultExpand);

  return (
    <div className="accordion" id="syntax-accordion">
      <Card>
        <CardHeader onClick={toggle}>
          <button className="btn btn-link" type="button">
            <h5>{title}</h5>
          </button>
        </CardHeader>
        <Collapse isOpen={expanded}>
          <CardBody>{children}</CardBody>
        </Collapse>
      </Card>
    </div>
  );
};

Accordion.propTypes = {
  defaultExpand: PropTypes.bool,
  children: PropTypes.node.isRequired,
  title: PropTypes.string.isRequired,
};

Accordion.defaultProps = {
  defaultExpand: false,
};

export default Accordion;
