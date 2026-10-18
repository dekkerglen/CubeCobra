import { slugify } from './slugify';

export interface PrimerTab {
  title: string;
  content: string;
}

export const PRIMER_MAX_TABS = 10;
export const PRIMER_MAX_TOTAL_CHARS = 100_000;
export const PRIMER_MAX_TITLE_LENGTH = 50;
export const LEGACY_PRIMER_TAB_TITLE = 'Primer';

const NEW_TAB_TITLE = 'New Tab';

export const slugifyTabTitle = slugify;

export const primerTabsFromLegacy = (description: string | null | undefined): PrimerTab[] => [
  { title: LEGACY_PRIMER_TAB_TITLE, content: description ?? '' },
];

export const totalPrimerLength = (tabs: PrimerTab[]): number => tabs.reduce((sum, tab) => sum + tab.content.length, 0);

const isPrimerTab = (value: unknown): value is PrimerTab =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as PrimerTab).title === 'string' &&
  typeof (value as PrimerTab).content === 'string';

export const validatePrimerTabs = (tabs: unknown): string | null => {
  if (!Array.isArray(tabs) || !tabs.every(isPrimerTab)) {
    return 'Invalid primer tabs.';
  }
  if (tabs.length < 1) {
    return 'Primer must have at least one tab.';
  }
  if (tabs.length > PRIMER_MAX_TABS) {
    return `Primer cannot have more than ${PRIMER_MAX_TABS} tabs.`;
  }

  const seen = new Set<string>();
  for (const tab of tabs) {
    if (tab.title.trim().length === 0) {
      return 'Every tab needs a title.';
    }
    if (tab.title.length > PRIMER_MAX_TITLE_LENGTH) {
      return `Tab titles must be ${PRIMER_MAX_TITLE_LENGTH} characters or fewer.`;
    }
    const slug = slugifyTabTitle(tab.title);
    if (!slug) {
      return `Tab title "${tab.title}" must contain at least one letter or number.`;
    }
    if (seen.has(slug)) {
      return `Two tabs share the link name "${slug}". Rename one of them.`;
    }
    seen.add(slug);
  }

  const total = totalPrimerLength(tabs);
  if (total > PRIMER_MAX_TOTAL_CHARS) {
    return `Primer is ${total.toLocaleString('en-US')} characters; the limit is ${PRIMER_MAX_TOTAL_CHARS.toLocaleString('en-US')} across all tabs.`;
  }

  return null;
};

export const findTabIndexBySlug = (tabs: PrimerTab[], slug: string | null | undefined): number => {
  if (!slug) {
    return 0;
  }
  const target = slugifyTabTitle(slug);
  const index = tabs.findIndex((tab) => slugifyTabTitle(tab.title) === target);
  return index === -1 ? 0 : index;
};

export const nextNewTabTitle = (tabs: PrimerTab[]): string => {
  const slugs = new Set(tabs.map((tab) => slugifyTabTitle(tab.title)));
  let title = NEW_TAB_TITLE;
  for (let n = 2; slugs.has(slugifyTabTitle(title)); n++) {
    title = `${NEW_TAB_TITLE} ${n}`;
  }
  return title;
};

export const prependToPrimaryTab = (tabs: PrimerTab[], text: string): PrimerTab[] =>
  tabs.map((tab, i) => (i === 0 ? { ...tab, content: text + tab.content } : tab));
