import React from 'react';

import PropTypes from 'prop-types';

import { FormGroup, Label, Col } from 'reactstrap';

const LabelRow = ({ htmlFor, label, children, ...props }) => (
  <FormGroup row {...props}>
    <Label xs="4" md="6" lg="5" htmlFor={htmlFor}>
      {label}
    </Label>
    <Col xs="8" md="6" lg="7">
      {children}
    </Col>
  </FormGroup>
);

LabelRow.propTypes = {
  htmlFor: PropTypes.string.isRequired,
  label: PropTypes.node.isRequired,
  children: PropTypes.node.isRequired,
};

export default LabelRow;
