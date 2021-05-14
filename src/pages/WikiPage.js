import React from 'react';
import PropTypes from 'prop-types';

import RenderToRoot from 'utils/RenderToRoot';

import Markdown from 'components/Markdown';

// Takes in markdown stored in a wiki file and transforms it into the markdown
// to be displayed on the site.
//
// This transformation could include things like...
// - Adding a link to the home page at the bottom of each page
// - ...
function markdownTransform(markdown) {
  return `${markdown}\n>>>[Back to wiki home page](/wiki/home)<<<`;
}

const WikiPage = ({ markdown }) => {
  return <Markdown markdown={markdownTransform(markdown)} />;
};

WikiPage.propTypes = {
  markdown: PropTypes.string.isRequired,
};

export default RenderToRoot(WikiPage);
