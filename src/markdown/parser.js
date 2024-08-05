import autoHeadings from 'rehype-autolink-headings';
import rehypeKatex from 'rehype-katex';
import slug from 'rehype-slug';
import breaks from 'remark-breaks';
import gfm from 'remark-gfm';
import math from 'remark-math';
import remark from 'remark-parse';
import { unified } from 'unified';

import cardlink from 'markdown/cardlink';
import cardrow from 'markdown/cardrow';
import centering from 'markdown/centering';
import symbols from 'markdown/symbols';
import userlink from 'markdown/userlink';

// remark plugins that are necessary in all use-cases
const BASE_PLUGINS = [cardrow, centering, math, cardlink, [gfm, { singleTilde: false }], symbols];

// all remark plugins used in the parser
export const ALL_PLUGINS = [...BASE_PLUGINS, userlink, breaks];

// rehype plugins used in all use-cases, including limited Markdown versions (i.e. comments)
export const LIMITED_REHYPE_PLUGINS = [rehypeKatex];

// rehype plugins used in fully-featured displays
export const ALL_REHYPE_PLUGINS = [...LIMITED_REHYPE_PLUGINS, slug, autoHeadings];

// runs parser to detect users that are mentioned in some Markdown content
export function findUserLinks(text) {
  const mentions = [];
  const processor = unified()
    .use(remark)
    .use(BASE_PLUGINS)
    .use(userlink, { callback: (name) => mentions.push(name) });
  processor.runSync(processor.parse(text));
  return mentions;
}

export default {
  findUserLinks,
  BASE_PLUGINS,
  ALL_PLUGINS,
};
