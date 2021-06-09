import React, { useMemo } from 'react';

import { UncontrolledAlert } from 'reactstrap';

const DynamicFlash = (props) => {
  const messages = useMemo(() => {
    if (typeof document !== 'undefined') {
      const flashInput = document.getElementById('flash');
      const flashValue = flashInput ? flashInput.value : '[]';
      return JSON.parse(flashValue);
    }
    return [];
  }, []);

  return (
    <div className="mt-3">
      {Object.keys(messages).map((type) =>
        messages[type].map((message, index) => (
          // eslint-disable-next-line react/no-array-index-key
          <UncontrolledAlert key={type + index} color={type} {...props}>
            {message}
          </UncontrolledAlert>
        )),
      )}
    </div>
  );
};

export default DynamicFlash;
