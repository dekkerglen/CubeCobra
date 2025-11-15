import React, { useState } from 'react';

import Banner from '../Banner';
import Button from '../base/Button';
import Controls from '../base/Controls';
import Input from '../base/Input';
import { Flexbox } from '../base/Layout';
import ResponsiveDiv from '../base/ResponsiveDiv';
import Select from '../base/Select';
import Text from '../base/Text';

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

  return (
    <Controls className="p-2">
      <Banner />
      <Text lg bold>
        {title}
      </Text>
      <Flexbox direction="row" justify="center" gap="2">
        <Input placeholder="Search cubes..." value={queryText} onChange={(event) => setQuery(event.target.value)} />
        <ResponsiveDiv sm>
          <Select
            options={searchOptions.map((search) => ({ value: search[1], label: search[0] }))}
            defaultValue={searchOrder}
            setValue={(value) => setSearchOrder(value)}
          />
        </ResponsiveDiv>
        <ResponsiveDiv sm>
          <Select
            options={[
              { value: 'true', label: 'Ascending' },
              { value: 'false', label: 'Descending' },
            ]}
            defaultValue={searchAscending}
            setValue={(value) => setSearchAscending(value)}
          />
        </ResponsiveDiv>
        <Button
          type="link"
          color="primary"
          href={`/search/?q=${encodeURIComponent(queryText)}&order=${searchOrder}&ascending=${searchAscending}`}
        >
          Search
        </Button>
      </Flexbox>
    </Controls>
  );
};

export default CubeSearchNavBar;
