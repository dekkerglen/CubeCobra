import React from 'react';
import PropTypes from 'prop-types';

import ReactMarkdown from 'react-markdown';

const Markdown = ({ markdown, limited}) => {
    const markdownStr = markdown?.toString() ?? '';
    return (<ReactMarkdown children={markdownStr} />);
}

Markdown.propTypes = {
    markdown: PropTypes.string.isRequired,
    limitied: PropTypes.bool,
}

Markdown.defaultProps = {
    limited: false,
}

export default Markdown;