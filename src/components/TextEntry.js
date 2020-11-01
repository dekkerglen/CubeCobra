import React, { useState } from 'react';
import PropTypes from 'prop-types';

import { Card, CardHeader, Input, Nav, TabPane, TabContent, CardBody } from 'reactstrap';

import Tab from 'components/Tab';
import Markdown from 'components/Markdown';
import ErrorBoundary from 'components/ErrorBoundary';

const TextEntry = ({ name, value, onChange, maxLength }) => {
  const [tab, setTab] = useState('0');

  return (
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
              className="w-100 text-input"
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
  );
};

TextEntry.propTypes = {
  name: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  maxLength: PropTypes.number.isRequired,
};

export default TextEntry;
