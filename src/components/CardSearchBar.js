import { Input, InputGroup, InputGroupAddon, Button } from 'reactstrap';

const CardSearchBar = () => {
  return (
    <form method="GET" action="/tool/searchcards" autoComplete="off" className="w-100">
      <div className="search-bar flex-container flex-align-stretch flex-grow">
        <InputGroup>
          <Input name="f" placeholder="Search Cards..." />
          <InputGroupAddon addonType="append">
            <Button className="search-button" type="submit" color="success">
              Go
            </Button>
          </InputGroupAddon>
        </InputGroup>
      </div>
    </form>
  );
};

export default CardSearchBar;
