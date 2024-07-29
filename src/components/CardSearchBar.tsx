import React from 'react';
import { Input, InputGroup, Button } from 'reactstrap';

export interface CardSearchBarProps {}

const CardSearchBar: React.FC<CardSearchBarProps> = () => {
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
