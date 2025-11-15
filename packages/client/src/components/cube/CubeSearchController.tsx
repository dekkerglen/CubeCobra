import React, { useState } from 'react';

import Banner from '../Banner';
import Controls from '../base/Controls';
import Input from '../base/Input';
import { Col, Row } from '../base/Layout';
import Select from '../base/Select';
import Text from '../base/Text';
import LoadingButton from '../LoadingButton';

interface CubeSearchControllerProps {
  query?: string;
  order?: string;
  title?: string;
  ascending?: string;
  go: (query: string, order: string, ascending: string) => Promise<void>;
}

const CubeSearchController: React.FC<CubeSearchControllerProps> = ({
  query = '',
  order = 'pop',
  title = null,
  ascending = false,
  go,
}) => {
  const [queryText, setQuery] = useState<string>(query);
  const [searchOrder, setSearchOrder] = useState<string>(order);
  const [searchAscending, setSearchAscending] = useState<string>(ascending.toString());

  const searchOptions: [string, string][] = [
    ['Sorted by Popularity', 'pop'],
    ['Sorted Alphabetically', 'alpha'],
    ['Sorted by Card Count', 'cards'],
  ];

  return (
    <Controls className="p-2">
      <Banner />
      <Text lg bold>
        {title}
      </Text>
      <Row xs={12}>
        <Col xs={12} sm={3}>
          <Input
            placeholder="Search cubes..."
            value={queryText}
            onEnter={() => go(queryText, searchOrder, searchAscending)}
            onChange={(event) => setQuery(event.target.value)}
          />
        </Col>
        <Col xs={6} sm={3}>
          <Select
            options={searchOptions.map((search) => ({ value: search[1], label: search[0] }))}
            defaultValue={searchOrder}
            setValue={(value) => setSearchOrder(value)}
          />
        </Col>
        <Col xs={6} sm={3}>
          <Select
            options={[
              { value: 'true', label: 'Ascending' },
              { value: 'false', label: 'Descending' },
            ]}
            defaultValue={searchAscending}
            setValue={(value) => setSearchAscending(value)}
          />
        </Col>
        <Col xs={12} sm={3}>
          <LoadingButton block color="primary" onClick={() => go(queryText, searchOrder, searchAscending)}>
            <span className="px-4">Search</span>
          </LoadingButton>
        </Col>
      </Row>
    </Controls>
  );
};

export default CubeSearchController;
