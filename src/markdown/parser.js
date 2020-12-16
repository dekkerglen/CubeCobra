import unified from 'unified';
import remark from 'remark-parse';
import gfm from 'remark-gfm';
import math from 'remark-math';
import slug from 'remark-slug';
import headings from 'remark-autolink-headings';
import cardlink from 'markdown/cardlink';
import cardrow from 'markdown/cardrow';
import centering from 'markdown/centering';
import breaks from 'remark-breaks';
import symbols from 'markdown/symbols';
import userlink from 'markdown/userlink';

const VALID_SYMBOLS = 'wubrgcmtsqepxyz/-0123456789';

const BASE_PLUGINS = [
  cardrow,
  centering,
  breaks,
  math,
  cardlink,
  [gfm, { singleTilde: false }],
  [symbols, { allowed: VALID_SYMBOLS }],
];

export const LIMITED_PLUGINS = [...BASE_PLUGINS, userlink];

export const ALL_PLUGINS = [...LIMITED_PLUGINS, slug, headings];

export function findUserlinks(text) {
  const mentions = [];
  const processor = unified().use(remark).use(BASE_PLUGINS).use(userlink, { users: mentions });
  processor.runSync(processor.parse(text));
  return mentions;
}

export default {
  findUserlinks,
  VALID_SYMBOLS,
  BASE_PLUGINS,
  LIMITED_PLUGINS,
  ALL_PLUGINS,
};
