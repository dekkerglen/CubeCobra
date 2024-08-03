import React, { ChangeEventHandler, useState } from 'react';
import { Card, CardBody, CardHeader, FormText, Input, Nav, TabContent, TabPane } from 'reactstrap';

import ErrorBoundary from 'components/ErrorBoundary';
import Markdown from 'components/Markdown';
import Tab from 'components/Tab';

interface TextEntryProps {
  name?: string;
  value: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
  maxLength?: number;
}

const TextEntry: React.FC<TextEntryProps> = ({ name = 'hiddentextarea', value = '', onChange, maxLength = 1000 }) => {
  const [tab, setTab] = useState('0');

  return (
    <>
      <Card>
        <ErrorBoundary>
          <CardHeader className="p-0">
            <Nav className="mt-2" tabs justified>
              <Tab tab={tab} setTab={setTab} index="0">
                Source
              </Tab>
              <Tab tab={tab} setTab={setTab} index="1">
                Preview
              </Tab>
            </Nav>
          </CardHeader>
          <TabContent activeTab={tab}>
            <TabPane tabId="0">
              <Input
                type="textarea"
                name="textarea"
                maxLength={maxLength}
                className="w-100 markdown-input"
                value={value}
                onChange={onChange}
              />
            </TabPane>
            <TabPane tabId="1">
              <CardBody>
                <Markdown markdown={value} />
              </CardBody>
            </TabPane>
          </TabContent>
        </ErrorBoundary>
        <Input type="hidden" name={name} maxLength={maxLength} value={value} />
      </Card>
      <FormText>
        Having trouble formatting your posts? Check out the{' '}
        <a href="/markdown" target="_blank">
          markdown guide
        </a>
        .
      </FormText>
    </>
  );
};

export default TextEntry;
