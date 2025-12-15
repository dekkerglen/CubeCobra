import React, { useState } from 'react';

import { QuestionIcon } from '@primer/octicons-react';

import Banner from '../Banner';
import Button from '../base/Button';
import Controls from '../base/Controls';
import { Flexbox } from '../base/Layout';
import Input from '../base/Input';
import { Col, Row } from '../base/Layout';
import Select from '../base/Select';
import Text from '../base/Text';
import LoadingButton from '../LoadingButton';
import SearchSyntaxModal from '../modals/SearchSyntaxModal';

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
  const [showSyntaxModal, setShowSyntaxModal] = useState<boolean>(false);

  const searchOptions: [string, string][] = [
    ['Sorted by Popularity', 'pop'],
    ['Sorted Alphabetically', 'alpha'],
    ['Sorted by Card Count', 'cards'],
    ['Sorted by Last Updated', 'date'],
  ];

  return (
    <Controls className="p-2">
      <Banner />
      <Text lg bold>
        {title}
      </Text>
      <Row xs={12}>
        <Col xs={12} sm={3}>
          <Flexbox direction="row" gap="1" alignItems="center">
            <button
              onClick={() => setShowSyntaxModal(true)}
              className="text-green-600 hover:text-green-700 cursor-pointer"
              aria-label="Search syntax help"
            >
              <QuestionIcon size={20} />
            </button>
            <Input
              placeholder="Search cubes..."
              value={queryText}
              onEnter={() => go(queryText, searchOrder, searchAscending)}
              onChange={(event) => setQuery(event.target.value)}
            />
          </Flexbox>
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
      <SearchSyntaxModal isOpen={showSyntaxModal} setOpen={setShowSyntaxModal} />
    </Controls>
  );
};

export default CubeSearchController;
