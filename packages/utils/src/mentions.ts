/**
 * Validation for `@username` mentions.
 *
 * Mentions are extracted in the browser by the Markdown pipeline and POSTed alongside the body, so the
 * claimed list is untrusted input: without a check, a request can notify people a post never mentions.
 * `resolveMentions` bounds that list by what the body actually contains.
 *
 * The pattern below reproduces the userlink tokenizer's rule that `@` must follow the start of the text
 * or whitespace and nothing else — so `**@bob**`, `(@bob)`, `[@bob](url)` and `https://x.com/@bob` are
 * all non-mentions, matching the renderer. It cannot see Markdown structure, so unlike the tokenizer it
 * also matches inside code spans and code blocks. That over-matching is deliberate and safe: the result
 * is only ever intersected with the client's list, so it can widen what is allowed but never what is
 * sent. Using it on its own would start notifying for mentions the renderer does not link.
 */
const MENTION_RE = /(?<=^|[ \t\r\n])@([a-zA-Z0-9]+)/g;

// Upper bound on how many people one post may notify. Well above a post thanking a handful of people,
// far below anything useful for spam. Applied by truncation: the post itself still saves in full.
export const MAX_MENTIONS = 20;

/** Usernames `text` could mention, in order of appearance, original casing, duplicates included. */
export const extractMentions = (text: string): string[] => {
  if (typeof text !== 'string' || text === '') {
    return [];
  }
  const names: string[] = [];
  for (const match of text.matchAll(MENTION_RE)) {
    if (match[1]) {
      names.push(match[1]);
    }
  }
  return names;
};

/**
 * The claimed mentions that `body` actually contains: deduplicated case-insensitively, keeping the
 * claimed spelling and order, and capped at `MAX_MENTIONS`.
 *
 * `body` must be the text that will be *stored*. Both callers truncate before saving, and deriving from
 * the untruncated request would let a mention past the cut validate against text no reader ever sees.
 */
export const resolveMentions = (body: string, claimed: string | undefined | null): string[] => {
  if (typeof claimed !== 'string' || claimed.trim() === '') {
    return [];
  }

  const present = new Set(extractMentions(body).map((name) => name.toLowerCase()));
  if (present.size === 0) {
    return [];
  }

  const resolved: string[] = [];
  const seen = new Set<string>();
  for (const name of claimed.split(';')) {
    const trimmed = name.trim();
    const key = trimmed.toLowerCase();
    if (trimmed === '' || seen.has(key) || !present.has(key)) {
      continue;
    }
    seen.add(key);
    resolved.push(trimmed);
    if (resolved.length === MAX_MENTIONS) {
      break;
    }
  }
  return resolved;
};

export default { MAX_MENTIONS, extractMentions, resolveMentions };
