import React from 'react';
import PropTypes from 'prop-types';

import RenderToRoot from 'utils/RenderToRoot';

import PackagesPage from 'pages/PackagesPage';

function UserPackagesPage({ loginCallback, items, lastKey }) {
  return <PackagesPage loginCallback={loginCallback} items={items} lastKey={lastKey} activePage="user" />;
}

UserPackagesPage.propTypes = {
  loginCallback: PropTypes.string,
  items: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  lastKey: PropTypes.string.isRequired,
};

UserPackagesPage.defaultProps = {
  loginCallback: '/',
};

export default RenderToRoot(UserPackagesPage);
