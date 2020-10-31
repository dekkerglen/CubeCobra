import React from 'react';
import PropTypes from 'prop-types';

import ReactMarkdown from 'react-markdown';
import Latex from 'react-latex'
import math from 'remark-math';
import userlink from 'markdown/userlink';
import strikethrough from 'markdown/strikethrough';
import symbols from 'markdown/symbols';

function renderMath(node) {
    return (<Latex trusted={false} displayMode>{`$$ ${node.value} $$`}</Latex>);
}

function renderInlineMath(node) {
    return (<Latex trusted={false}>{`$ ${node.value} $`}</Latex>);
}

function renderUserlink(node) {
    const name = node.value;
    return (<a
              href={`/user/view/${name}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              @{name}
            </a>
        );
}

function renderSymbol(node) {
    const symbol = node.value.replace('/', '-').toLowerCase();
    return (<img
              src={`/content/symbols/${symbol}.png`}
              alt={symbol}
              className="mana-symbol-sm"
            />
    );
}

const Markdown = ({ markdown, limited}) => {
    const renderers = {
        math: renderMath,
        inlineMath: renderInlineMath,
        userlink: renderUserlink,
        symbol: renderSymbol,
    };

    const validSymbols = "wubrgcmtsqepxyz/-0123456789";
    const markdownStr = markdown?.toString() ?? '';
    return (<ReactMarkdown children={markdownStr} plugins={[math, userlink, strikethrough, [symbols, {allowed: validSymbols}]]} renderers={renderers}/>);
}

Markdown.propTypes = {
    markdown: PropTypes.string.isRequired,
    limitied: PropTypes.bool,
}

Markdown.defaultProps = {
    limited: false,
}

export default Markdown;