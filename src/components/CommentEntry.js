import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Collapse } from 'reactstrap';

import LinkButton from 'components/LinkButton';

const CommentEntry = ({ submit, expanded, toggle }) => {
  const [text, setText] = useState('');

  return (
    <Collapse isOpen={expanded}>
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        className="form-control"
        id="exampleFormControlTextarea1"
        rows="2"
        maxLength="500"
      />
      <LinkButton
        onClick={() => {
          submit(text);
          toggle();
          setText('');
        }}
      >
        <small>Submit</small>
      </LinkButton>
      <LinkButton className="ml-2" onClick={toggle}>
        <small>Cancel</small>
      </LinkButton>
    </Collapse>
  );
};

CommentEntry.propTypes = {
  submit: PropTypes.func.isRequired,
  expanded: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
};

export default CommentEntry;
