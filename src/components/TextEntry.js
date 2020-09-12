import React, { useState } from 'react';
import PropTypes from 'prop-types';

import { Card, CardHeader, Input, Nav, TabPane, TabContent, CardBody } from 'reactstrap';

import Tab from 'components/Tab';
import MagicMarkdown from 'components/MagicMarkdown';

const TextEntry = ({ name, value, onChange, maxLength }) => {
  const [tab, setTab] = useState('0');

  return (
    <Card>
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
            name={name}
            maxLength={maxLength}
            className="w-100 text-input"
            value={value}
            onChange={onChange}
          />
        </TabPane>
        <TabPane tabId="1">
          <CardBody>
            <MagicMarkdown markdown={value} />
          </CardBody>
        </TabPane>
      </TabContent>
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
