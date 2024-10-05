import React from 'react';
import { Flexbox } from './base/Layout';
import Input from './base/Input';
import Button from './base/Button';

const CardSearchBar: React.FC = () => {
  return (
    <form method="GET" action="/tool/searchcards" autoComplete="off" className="w-100">
      <Flexbox direction="row" className="w-100" justify="between" gap="1">
        <Input name="f" placeholder="Search cards..." className="flex-grow" />
        <Button type="submit" color="primary">
          <span className="px-4">Go</span>
        </Button>
      </Flexbox>
    </form>
  );
};

export default CardSearchBar;
