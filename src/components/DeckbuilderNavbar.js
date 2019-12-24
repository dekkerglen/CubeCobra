import React, { useCallback, useRef, useState } from 'react';

import { Collapse, Nav, Navbar, NavItem, NavLink, Input } from 'reactstrap';

import CSRFForm from './CSRFForm';

export default ({ deck }) => {
  const [isOpen, setIsOpen] = useState(false);
  const saveForm = useRef(null);
  const saveDeck = useCallback((event) => {
    event.preventDefault();
    if (saveForm.current) {
      saveForm.current.submit();
    }
  }, [saveForm]);
  return (
    <div className="usercontrols">
      <Navbar expand="md" className="navbar-light">
        <Collapse isOpen={isOpen} navbar>
          <Nav navbar>
            <NavItem>
              <NavLink href="#" onClick={saveDeck}>Save Deck</NavLink>
              <CSRFForm className="d-none" innerRef={saveForm} method="POST" action={`/cube/editdeck/${deck._id}`}>
                <Input type="hidden" name="draftraw" value={JSON.stringify(deck)} />
              </CSRFForm>
            </NavItem>
            <NavItem>
              <NavLink href="#">Add Basic Lands</NavLink>
            </NavItem>
            <NavItem>
              <NavLink href="#">Show Custom Images</NavLink>
            </NavItem>
          </Nav>
        </Collapse>
      </Navbar>
    </div>
  );
};
