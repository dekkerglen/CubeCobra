import React, { useState, FormEvent } from 'react';

import Banner from 'components/Banner';
import Button from 'components/base/Button';
import Input from 'components/base/Input';
import Select from 'components/base/Select';
import Text from 'components/base/Text';
import Controls from 'components/base/Controls';
import { Flexbox } from 'components/base/Layout';

interface CubeSearchNavBarProps {
  query?: string;
  order?: string;
  title?: string;
  ascending?: boolean;
}

const CubeSearchNavBar: React.FC<CubeSearchNavBarProps> = ({
  query = '',
  order = 'pop',
  title = null,
  ascending = false,
}) => {
  const [queryText, setQuery] = useState<string>(query);
  const [searchOrder, setSearchOrder] = useState<string>(order);
  const [searchAscending, setSearchAscending] = useState<string>(ascending.toString());

  const searchOptions: [string, string][] = [
    ['Sorted by Popularity', 'pop'],
    ['Sorted Alphabetically', 'alpha'],
    ['Sorted by Card Count', 'cards'],
  ];

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (queryText && queryText.length > 0) {
      window.location.href = `/search/${encodeURIComponent(queryText)}?order=${searchOrder}&ascending=${searchAscending}`;
    } else {
      window.location.href = `/search`;
    }
  };

  return (
    <Controls className="p-2">
      <Banner />
      <Text lg bold>
        {title}
      </Text>
      <form onSubmit={handleSubmit}>
        <Flexbox direction="row" justify="center" gap="2">
          <Input placeholder="Search cubes..." value={queryText} onChange={(event) => setQuery(event.target.value)} />
          <Select
            options={searchOptions.map((search) => ({ value: search[1], label: search[0] }))}
            defaultValue={searchOrder}
            setValue={(value) => setSearchOrder(value)}
          />
          <Select
            options={[
              { value: 'true', label: 'Ascending' },
              { value: 'false', label: 'Descending' },
            ]}
            defaultValue={searchAscending}
            setValue={(value) => setSearchAscending(value)}
          />
          <Button color="primary">
            <span className="px-4">Search</span>
          </Button>
        </Flexbox>
      </form>
    </Controls>
  );
};

export default CubeSearchNavBar;
