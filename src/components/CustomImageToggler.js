import { useContext } from 'react';

import { NavItem, NavLink } from 'reactstrap';

import DisplayContext from 'contexts/DisplayContext';

const CustomImageToggler = () => {
  const { showCustomImages, toggleShowCustomImages } = useContext(DisplayContext);
  return (
    <NavItem>
      <NavLink href="#" onClick={toggleShowCustomImages}>
        {showCustomImages ? 'Hide ' : 'Show '}
        Custom Images
      </NavLink>
    </NavItem>
  );
};

export default CustomImageToggler;
