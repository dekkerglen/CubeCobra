import React, { useState } from 'react';

import { Button, Modal, ModalBody, ModalFooter, ModalHeader, Navbar, Input, CardBody } from 'reactstrap';

import TextField from 'components/TextField';
import NumericField from 'components/NumericField';
import SelectField from 'components/SelectField';

const AdvancedSearchModal = ({ isOpen, toggle }) => {
  const [name, setName] = useState('');
  const [owner, setowner] = useState('');
  const [decks, setDecks] = useState('');
  const [cards, setCards] = useState('');
  const [category, setCategory] = useState('');

  const [decksOp, setDecksOp] = useState('=');
  const [cardsOp, setCardsOp] = useState('=');

  const Categories = [
    '',
    'Vintage',
    'Legacy+',
    'Legacy',
    'Modern',
    'Pioneer',
    'Standard',
    'Set',
    'Powered',
    'Unpowered',
    'Pauper',
    'Peasant',
    'Budget',
    'Silver-bordered',
    'Commander',
  ];
  const handleChange = (event) => {
    const { target } = event;
    const value = ['checkbox', 'radio'].includes(target.type) ? target.checked : target.value;
    const key = target.name;

    switch (key) {
      case 'name':
        setName(value);
        break;
      case 'owner':
        setowner(value);
        break;
      case 'decks':
        setDecks(value);
        break;
      case 'cards':
        setCards(value);
        break;
      case 'decksOp':
        setDecksOp(value);
        break;
      case 'cardsOp':
        setCardsOp(value);
        break;
      case 'category':
        setCategory(value);
        break;
      default:
        break;
    }
  };

  const submit = () => {
    console.log(name, owner, decks, cards);

    let queryText = '';

    if (name.length > 0) {
      queryText += `name:${name} `;
    }
    if (owner.length > 0) {
      queryText += `owner:${owner} `;
    }
    if (decks.length > 0) {
      queryText += `decks${decksOp}${decks} `;
    }
    if (cards.length > 0) {
      queryText += `cards${cardsOp}${cards} `;
    }
    if (category.length > 0) {
      queryText += `category:${category} `;
    }

    if (queryText.length > 0) {
      window.location.href = `/search/${queryText.trim()}/0`;
    } else {
      window.location.href = '/search';
    }
  };

  return (
    <>
      <Button color="success" onClick={toggle}>
        Advanced...
      </Button>
      <Modal size="lg" isOpen={isOpen} toggle={toggle}>
        <ModalHeader toggle={toggle}>Advanced Search</ModalHeader>
        <ModalBody>
          <TextField
            name="name"
            humanName="Cube Name"
            placeholder={'Any text in the name, e.g. "Innistrad"'}
            value={name}
            onChange={handleChange}
          />
          <TextField
            name="owner"
            humanName="Owner Name"
            placeholder={'Any text in the owner name, e.g. "TimFReilly"'}
            value={owner}
            onChange={handleChange}
          />
          <NumericField
            name="decks"
            humanName="Number of Decks"
            placeholder={'Any value, e.g. "2"'}
            value={decks}
            onChange={handleChange}
          />
          <NumericField
            name="cards"
            humanName="Number of Cards"
            placeholder={'Any value, e.g. "360"'}
            value={cards}
            onChange={handleChange}
          />
          <SelectField
            name="category"
            humanName="Cube Category"
            value={category}
            onChange={handleChange}
            options={Categories}
          />
        </ModalBody>
        <ModalFooter>
          <Button color="success" onClick={submit}>
            Search
          </Button>
          <Button color="secondary" onClick={toggle}>
            Close
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
};

const CubeSearchNavBar = ({ query, order, title }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [queryText, setQuery] = useState(query || '');
  const toggle = () => setIsOpen((open) => !open);
  const [searchOrder, setSearchIndex] = useState(order || 'date');

  const searchOptions = [['Date Updated', 'date'], ['Alphabetical', 'alpha'], ['Popularity', 'pop']];

  const handleChangeSearch = (event) => {
    setSearchIndex(event.target.value);
  };

  const handleChange = (event) => {
    setQuery(event.target.value);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    console.log(queryText.length);
    if (queryText && queryText.length > 0) {
      window.location.href = `/search/${queryText}/0?order=${searchOrder}`;
    } else {
      window.location.href = `/search`;
    }
  };

  return (
    <div className="usercontrols">
      {title && (
        <CardBody className="pb-0">
          <h3>{title}</h3>
        </CardBody>
      )}
      <form onSubmit={handleSubmit}>
        <Navbar expand="md" className="navbar-light">
          <Input
            className="form-control mr-sm-2"
            type="search"
            placeholder="Search Cubes..."
            aria-label="Search"
            value={queryText}
            onChange={handleChange}
          />
          <h6 className="noBreak mr-2 pt-2">Sorted by:</h6>
          <Input type="select" id="viewSelect" value={searchOrder} onChange={handleChangeSearch}>
            {searchOptions.map((search) => (
              <option key={search[1]} value={search[1]}>
                {search[0]}
              </option>
            ))}
          </Input>
          <Button color="success" className="mx-2">
            Search
          </Button>
          <AdvancedSearchModal isOpen={isOpen} toggle={toggle} setQuery={setQuery} />
        </Navbar>
      </form>
    </div>
  );
};

export default CubeSearchNavBar;
