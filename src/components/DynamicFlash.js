import React, { useMemo } from 'react';
import { Alert, UncontrolledAlert } from 'reactstrap';

import Markdown from 'components/Markdown';

const DynamicFlash = (props) => {
  const messages = useMemo(() => {
    if (typeof document !== 'undefined') {
      const flashInput = document.getElementById('flash');
      const flashValue = flashInput ? flashInput.value : '[]';
      const globalNotice = document.getElementById('global-notice')?.value;
      return { flash: JSON.parse(flashValue), notice: globalNotice };
    }
    return [];
  }, []);

  return (
    <div className="mt-3">
      {Object.keys(messages.flash).map((type) =>
        messages.flash[type].map((message, index) => (
          // eslint-disable-next-line react/no-array-index-key
          <UncontrolledAlert key={type + index} color={type} {...props}>
            {message}
          </UncontrolledAlert>
        )),
      )}
      {messages.notice && (
        <Alert id="notice-alert" color="warning">
          <Markdown markdown={messages.notice} />
        </Alert>
      )}
    </div>
  );
};

export default DynamicFlash;
