import React, { Dispatch, SetStateAction, useState } from 'react';

import Collapse from '../base/Collapse';
import Link from '../base/Link';
import Text from '../base/Text';
import TextArea from '../base/TextArea';

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
      <TextArea value={text} onChange={(event) => setText(event.target.value)} maxLength={5000} rows={3} />
      <Link
        onClick={() => {
          submit(text);
          toggle();
          setText('');
        }}
      >
        <Text sm>Submit</Text>
      </Link>
      <Link className="ms-2" onClick={toggle}>
        <Text sm>Cancel</Text>
      </Link>
    </Collapse>
  );
};

export default CommentEntry;
