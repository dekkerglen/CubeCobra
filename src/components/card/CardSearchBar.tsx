import React from 'react';
import { Flexbox } from 'components/base/Layout';
import Input from 'components/base/Input';
import Button from 'components/base/Button';

const CardSearchBar: React.FC = () => {
  const [search, setSearch] = React.useState('');

  return (
    <Flexbox direction="row" className="w-full" justify="between" gap="1">
      <Input
        name="f"
        placeholder="Search cards..."
        className="flex-grow"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            window.location.href = `/tool/searchcards?f=${encodeURIComponent(search)}`;
          }
        }}
      />
      <Button color="primary" href={`/tool/searchcards?f=${encodeURIComponent(search)}`}>
        <span className="px-4">Go</span>
      </Button>
    </Flexbox>
  );
};

export default CardSearchBar;
