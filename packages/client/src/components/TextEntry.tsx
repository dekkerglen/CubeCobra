import React, { useState } from 'react';

import { Card, CardBody } from './base/Card';
import Link from './base/Link';
import { TabbedView } from './base/Tabs';
import Text from './base/Text';
import TextArea from './base/TextArea';
import ErrorBoundary from './ErrorBoundary';
import Markdown from './Markdown';

interface TextEntryProps {
  name?: string;
  value: string;
  setValue: (value: string) => void;
  maxLength?: number;
  rows?: number;
}

const TextEntry: React.FC<TextEntryProps> = ({ value = '', setValue, maxLength = 1000, rows = 4 }) => {
  const [tab, setTab] = useState('0');

  return (
    <>
      <Card>
        <ErrorBoundary>
          <TabbedView
            activeTab={parseInt(tab, 10)}
            tabs={[
              {
                label: 'Source',
                content: (
                  <TextArea
                    name="textarea"
                    maxLength={maxLength}
                    className="w-full markdown-input"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    showCharacterLimit={true}
                    rows={rows}
                  />
                ),
                onClick: () => setTab('0'),
              },
              {
                label: 'Preview',
                content: (
                  <CardBody>
                    <Markdown markdown={value} />
                  </CardBody>
                ),
                onClick: () => setTab('1'),
              },
            ]}
          />
        </ErrorBoundary>
      </Card>
      <Text sm italic>
        Having trouble formatting your posts? Check out the{' '}
        <Link href="/markdown" target="_blank">
          markdown guide
        </Link>
        .
      </Text>
    </>
  );
};

export default TextEntry;
