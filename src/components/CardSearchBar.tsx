import React from 'react';
import { Button, Input, InputGroup } from 'reactstrap';

const CardSearchBar: React.FC = () => {
  return (
    <form method="GET" action="/tool/searchcards" autoComplete="off" className="w-100">
      <div className="search-bar flex-container flex-align-stretch flex-grow">
        <InputGroup>
          <Input name="f" placeholder="Search cards..." />
          <Button className="search-button" type="submit" color="accent">
            Go
          </Button>
        </InputGroup>
      </div>
    </form>
  );
};

export default CardSearchBar;
