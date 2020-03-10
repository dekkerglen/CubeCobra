import React, { useCallback, useState } from 'react';

import { Button, Modal, ModalBody, ModalFooter, ModalHeader, Navbar } from 'reactstrap';

const AdvancedSearchModal = ({ isOpen, toggle }) => {
  return (
    <>
      <Button color="success" onClick={toggle}>
        Advanced...
      </Button>
      <Modal isOpen={isOpen} toggle={toggle}>
        <ModalHeader toggle={toggle}>Advanced Search</ModalHeader>
        <ModalBody />
        <ModalFooter>
          <Button color="success" type="submit">
            Submit
          </Button>
          <Button color="secondary" onClick={toggle}>
            Close
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
};

const CubeSearchNavBar = (query) => {
  const [isOpen, setIsOpen] = useState(false);
  const [queryText, setQuery] = useState(query || '');
  const toggle = () => setIsOpen((open) => !open);

  const handleChange = (event) => {
    setQuery(event.target.value);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    window.location.href = `/search/${queryText}`;
  };

  console.log(query, queryText);

  return (
    <div className="usercontrols">
      <form onSubmit={handleSubmit}>
        <Navbar expand="md" className="navbar-light">
          <input
            className="form-control mr-sm-2"
            type="search"
            placeholder="Search Cubes..."
            aria-label="Search"
            value={queryText}
            onChange={handleChange}
          />
          <Button color="success" className="mr-2">
            Search
          </Button>
          <AdvancedSearchModal isOpen={isOpen} toggle={toggle} />
        </Navbar>
      </form>
    </div>
  );
};

export default CubeSearchNavBar;
