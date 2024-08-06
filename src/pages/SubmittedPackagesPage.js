import React from 'react';

import PropTypes from 'prop-types';

import RenderToRoot from 'components/RenderToRoot';
import PackagesPage from 'pages/PackagesPage';

const SubmittedPackagesPage = ({ loginCallback, items, lastKey }) => {
  return <PackagesPage loginCallback={loginCallback} items={items} lastKey={lastKey} activePage="submitted" />;
};

SubmittedPackagesPage.propTypes = {
  loginCallback: PropTypes.string,
  items: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  lastKey: PropTypes.string.isRequired,
};

SubmittedPackagesPage.defaultProps = {
  loginCallback: '/',
};

export default RenderToRoot(SubmittedPackagesPage);
