import React, { Dispatch, SetStateAction, useState } from 'react';
import { Collapse } from 'reactstrap';

import LinkButton from 'components/LinkButton';

export interface CommentEntryProps {
  submit: (text: string) => void;
  expanded: boolean;
  toggle: () => void;
  defaultValue?: string;
}

const CommentEntry: React.FC<CommentEntryProps> = ({ submit, expanded, toggle, defaultValue = '' }) => {
  const [text, setText]: [string, Dispatch<SetStateAction<string>>] = useState(defaultValue);

  return (
    <Collapse isOpen={expanded}>
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        className="form-control"
        id="exampleFormControlTextarea1"
        rows={2}
        maxLength={5000}
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
      <LinkButton className="ms-2" onClick={toggle}>
        <small>Cancel</small>
      </LinkButton>
    </Collapse>
  );
};

export default CommentEntry;
