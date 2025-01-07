import React, { useContext } from 'react';
import DisplayContext from '../contexts/DisplayContext';
import Link from './base/Link';

const CustomImageToggler: React.FC = () => {
  const { showCustomImages, toggleShowCustomImages } = useContext(DisplayContext);

  return (
    <Link href="#" onClick={toggleShowCustomImages} className="nav-link">
      {showCustomImages ? 'Hide ' : 'Show '}
      Custom Images
    </Link>
  );
};

export default CustomImageToggler;
