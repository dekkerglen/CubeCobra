import User from '@utils/datatypes/User';

import { NextFunction, Request, Response } from '../types/express';

const shuffleSeed = require('shuffle-seed');
const { UserRoles } = require('@utils/datatypes/User');
const Notification = require('dynamo/models/notification');

// Simple profanity filter replacement to avoid ES module issues
class SimpleProfanityFilter {
  private badWords: Set<string>;

  constructor() {
    this.badWords = new Set([
      // Default bad words (excluding the ones we want to remove)
      'damn',
      'shit',
      'fuck',
      'bitch',
      'ass',
      'bastard',
      'crap',
      // Additional words to filter
      'dhabi',
      'dubai',
      'persian',
      'escort',
      'call girl',
      'scandal',
      'onlyfans',
      'leaked',
      'pdf',
      'download',
      'xbox',
      'gift card',
      'vbucks',
      'v-bucks',
      'streaming',
      'bitcoin',
      'cryptocurrency',
      'crypto',
      'nft',
      'coinbase',
      'ozempic',
      'xanax',
      'viagra',
      'tramadol',
      'adderall',
      'percocet',
      'oxycontin',
      'vicodin',
      'hydrocodone',
      'codeine',
      'morphine',
      'fentanyl',
      'ambien',
      'valium',
      'ativan',
      'dilaudid',
      'alprazolam',
      'meridia',
      'phentermine',
      'fioricet',
      'google play',
      'coin master',
      'robux',
      'roblox',
      'monopoly go',
      'monopoly-go',
      'fullmovie',
      'ultimate guide',
      'nude',
      'deepnude',
      'undress',
      'deepfake',
    ]);
  }

  isProfane(text: string): boolean {
    if (!text) return false;
    const lowerText = text.toLowerCase();
    return Array.from(this.badWords).some((word) => lowerText.includes(word));
  }

  clean(text: string): string {
    if (!text) return text;
    let cleanText = text;
    this.badWords.forEach((word) => {
      const regex = new RegExp(word, 'gi');
      cleanText = cleanText.replace(regex, '*'.repeat(word.length));
    });
    return cleanText;
  }

  addWords(...words: string[]): void {
    words.forEach((word) => this.badWords.add(word.toLowerCase()));
  }

  removeWords(...words: string[]): void {
    words.forEach((word) => this.badWords.delete(word.toLowerCase()));
  }
}

const filter = new SimpleProfanityFilter();
const removeWords = ['hell', 'sadist', 'God'];
filter.removeWords(...removeWords);

/**
 * Transforms a string with Unicode substitutions into regular text.
 * @param {string} text - The input string with Unicode substitutions.
 * @returns {string} - The transformed string with regular text.
 */
function normalizeUnicode(text: string): string {
  if (!text) return '';

  // Normalize the Unicode string to its canonical form
  return text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
}

function hasProfanity(text: string): boolean {
  if (!text) return false;

  const variations = [
    text,
    text.replace(/[^a-zA-Z0-9 ]/g, ''),
    normalizeUnicode(text),
    normalizeUnicode(text).replace(/[^a-zA-Z0-9 ]/g, ''),
  ];

  return variations.some((variation) => filter.isProfane(variation));
}

function validateEmail(email: string): boolean {
  if (email.includes('+')) {
    throw new Error(
      'CubeCobra does not support plus email addressing, please remove the "+descriptor" from your email and try again.',
    );
  }

  const bannedDomains = [
    'evusd.com',
    'yomail.edu.pl',
    'munik.edu.pl',
    'thetechnext.net',
    'mailmagnet.co',
    'cctoolz.com',
    'chosenx.com',
    'mowline.com',
    'greatphone.co.uk',
    'azuretechtalk.net',
    'kisoq.com',
    'myfxspot.com',
    'teleg.eu',
    'ronete.com',
    'rabitex.com',
    'polkaroad.net',
    'kelenson.com',
    'owube.com',
    'jxpomup.com',
    'datquynhon.net',
    'finestudio.org',
    'myfxspot.com',
    'inboxorigin.com',
    'allfreemail.net',
    'gufum.com',
    'surveyees.com',
    'rabitex.com',
    'horizonspost.com',
    'moonapps.org',
    'freesourcecodes.com',
    'fast.edu.pl',
    'ronete.com',
    'wanadoo.fr',
    'astmemail.com',
    'wmail.cam',
    'crowfiles.shop',
    'reduceness.com',
    'web.de',
    'adminzoom.com',
    'starmail.net',
    'diginey.com',
    'somelora.com',
    'qacmjeq.com',
    'qejjyl.com',
    'jxpomup.com',
    'zlorkun.com',
    'gufum.com',
    'gmailbrt.com',
    'gholar.com',
    'logsmarter.net',
    'pixdd.com',
    'matmayer.com',
  ];

  const domain = email.split('@')[1];

  if (domain && bannedDomains.includes(domain)) {
    throw new Error(
      'CubeCobra does not support email addresses from this domain, please use a different email address.',
    );
  }

  return true;
}

function generateEditToken() {
  // Not sure if this function is actually used anywhere.
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function toBase36(num: number): string {
  return num.toString(36);
}

function fromBase36(str: string): number {
  if (!str) return 0;
  return parseInt(str, 36);
}

function addWordToTree(obj: any, word: string): void {
  if (word.length <= 0) {
    return;
  }
  if (word.length === 1) {
    if (!obj[word.charAt(0)]) {
      obj[word.charAt(0)] = {
        $: {},
      };
    } else {
      obj[word.charAt(0)].$ = {};
    }
  } else {
    const character = word.charAt(0);
    word = word.substr(1, word.length);
    if (!obj[character]) {
      obj[character] = {};
    }
    addWordToTree(obj[character], word);
  }
}

function binaryInsert(value: any, array: any[], startVal?: number, endVal?: number) {
  const { length } = array;
  const start = typeof startVal !== 'undefined' ? startVal : 0;
  const end = typeof endVal !== 'undefined' ? endVal : length - 1; //! ! endVal could be 0 don't use || syntax
  const m = start + Math.floor((end - start) / 2);

  if (length === 0) {
    array.push(value);
    return;
  }

  if (value > array[end]) {
    array.splice(end + 1, 0, value);
    return;
  }

  if (value < array[start]) {
    array.splice(start, 0, value);
    return;
  }

  if (start >= end) {
    return;
  }

  if (value < array[m]) {
    binaryInsert(value, array, start, m - 1);
    return;
  }

  if (value > array[m]) {
    binaryInsert(value, array, m + 1, end);
  }
}

function newCard(cardDetails: any, tags: any, defaultStatus = 'Owned') {
  return {
    tags: Array.isArray(tags) ? tags : [],
    status: defaultStatus,
    colors: cardDetails.color_identity,
    cmc: cardDetails.cmc,
    cardID: cardDetails.scryfall_id,
    type_line: cardDetails.type,
    addedTmsp: new Date(),
    finish: 'Non-foil',
  };
}

function addCardToBoard(board: any[], cube: any, cardDetails: any, tags: any) {
  if (cardDetails.error) {
    return;
  }

  const card = newCard(cardDetails, tags, cube.defaultStatus || 'Owned');
  board.push(card);
}

function fromEntries(entries: [string, any][]): Record<string, any> {
  const obj: Record<string, any> = {};
  for (const [k, v] of entries) {
    obj[k] = v;
  }
  return obj;
}

async function addNotification(to: User, from: User | null, url: string, text: string) {
  if (!from) {
    // system notification
    return await Notification.put({
      date: new Date().valueOf(),
      to: `${to.id}`,
      from: '5d1125b00e0713602c55d967', // Dekkaru's user ID 😏
      fromUsername: 'Dekkaru',
      url,
      body: text,
    });
  }

  if (to.username === from.username) {
    return; // we don't need to give notifications to ourselves
  }

  await Notification.put({
    date: new Date().valueOf(),
    to: `${to.id}`,
    from: `${from.id}`,
    fromUsername: from.username,
    url,
    body: text,
  });
}

function wrapAsyncApi(route: (req: Request, res: Response, next: NextFunction) => Promise<void> | void) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      return route(req, res, next);
    } catch (err: unknown) {
      req.logger.error((err as Error).message, (err as Error).stack);
      return res.status(500).send({
        success: 'false',
        message: 'Internal server error',
      });
    }
  };
}

function toNonNullArray(arr: any): any[] {
  if (!arr) return [];
  if (!Array.isArray(arr)) return typeof arr === 'object' ? Object.values(arr) : [];
  return arr;
}

function mapNonNull(arr: any, f: (item: any) => any): any[] {
  return toNonNullArray(arr).map(f);
}

function flatten(arr: any, n: number): any[] {
  if (n <= 1) return toNonNullArray(arr);
  return toNonNullArray(([] as any[]).concat(...mapNonNull(arr, (a: any) => flatten(a, n - 1))));
}

function getBaseUrl() {
  return (process.env?.HTTP_ONLY === 'true' ? 'http://' : 'https://') + process.env.DOMAIN;
}

/*
 * Returns the root relative path, based on the referrer header. Since referrer header can be manipulated,
 * we only return a non-null value if it is not to another domain
 */
const getSafeReferrer = (req: Request) => {
  const referrer = req.header('Referrer') || null;

  if (referrer === null) {
    return null;
  }

  //Use our domain as the base in case the referrer is relative somehow
  let url;
  try {
    url = new URL(referrer, getBaseUrl());
  } catch {
    return null;
  }

  //Because of us setting the base in the parsing, we can ensure the host isn't another site.
  //We are also OK with www. version of the site. Host contains both domain and port, if the port isn't standard/aligns with protocol
  if (!(url.host === process.env.DOMAIN || url.host === `www.${process.env.DOMAIN}`)) {
    return null;
  }

  //Only if its a valid URL and isn't to some other website, then return the pathname (so no query string etc)
  return url.pathname;
};

const util = {
  shuffle(array: any[], seed?: number) {
    if (!seed) {
      seed = Date.now();
    }
    return shuffleSeed.shuffle(array, seed);
  },
  turnToTree(arr: string[]) {
    const res: Record<string, any> = {};
    arr.forEach((item) => {
      addWordToTree(res, item);
    });
    return res;
  },
  addWordToTree,
  binaryInsert,
  newCard,
  addCardToCube: addCardToBoard,
  arraysEqual(a: any[], b: any[]) {
    if (a === b) return true;
    if (a === null || b === null) return false;
    if (a.length !== b.length) return false;

    for (let i = 0; i < a.length; ++i) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  },
  generateEditToken,
  toBase36,
  fromBase36,
  hasProfanity,
  fromEntries,
  isAdmin(user: User) {
    return user && user.roles && user.roles.includes(UserRoles.ADMIN);
  },
  addNotification,
  wrapAsyncApi,
  toNonNullArray,
  flatten,
  mapNonNull,
  validateEmail,
  getBaseUrl,
  getSafeReferrer,
};

// Provide both ES module default export and CommonJS module.exports for compatibility
export default util;
export { addNotification };

// Ensure CommonJS consumers (require(...)) receive the util object directly

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  // Assign to module.exports so `const util = require('./util')` works as before

  module.exports = util;
}
