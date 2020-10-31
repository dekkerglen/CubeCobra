import React from 'react';
import PropTypes from 'prop-types';

import ReactMarkdown from 'react-markdown';
import Latex from 'react-latex'

import math from 'remark-math';

function renderMath(node) {
    return (<Latex trusted={false} displayMode>{`$$ ${node.value} $$`}</Latex>);
}

function renderInlineMath(node) {
    return (<Latex trusted={false}>{`$ ${node.value} $`}</Latex>);
}

const Markdown = ({ markdown, limited}) => {
    const renderers = {
        math: renderMath,
        inlineMath: renderInlineMath,
    };

    const markdownStr = markdown?.toString() ?? '';
    return (<ReactMarkdown children={markdownStr} plugins={[math]} renderers={renderers}/>);
}

Markdown.propTypes = {
    markdown: PropTypes.string.isRequired,
    limitied: PropTypes.bool,
}

Markdown.defaultProps = {
    limited: false,
}

export default Markdown;