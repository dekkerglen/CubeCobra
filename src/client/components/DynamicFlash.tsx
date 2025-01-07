import React, { useMemo } from 'react';

import Alert from './base/Alert';
import Markdown from './Markdown';

interface DynamicFlashProps {
  [key: string]: any;
}

interface FlashMessages {
  [key: string]: string[];
}

interface Messages {
  flash: FlashMessages;
  notice: string | null;
}

const DynamicFlash: React.FC<DynamicFlashProps> = (props) => {
  const messages: Messages = useMemo(() => {
    if (typeof document !== 'undefined') {
      const flashInput = document.getElementById('flash') as HTMLInputElement | null;
      const flashValue = flashInput ? flashInput.value : '[]';
      const globalNotice = (document.getElementById('global-notice') as HTMLInputElement | null)?.value || null;
      return { flash: JSON.parse(flashValue), notice: globalNotice };
    }
    return { flash: {}, notice: null };
  }, []);

  return (
    <div>
      {Object.keys(messages.flash).map((type) =>
        messages.flash[type].map((message, index) => (
          <Alert key={type + index} color={type} {...props}>
            {message}
          </Alert>
        )),
      )}
      {messages.notice && (
        <Alert color="warning">
          <Markdown markdown={messages.notice} />
        </Alert>
      )}
    </div>
  );
};

export default DynamicFlash;
