import Card, { CardStatus } from './Card';
import { DraftFormat } from './Draft';
import User from './User';

export const CUBE_VISIBILITY = {
  PUBLIC: 'pu',
  PRIVATE: 'pr',
  UNLISTED: 'un',
};

export const PRICE_VISIBILITY = {
  PUBLIC: 'pu',
  PRIVATE: 'pr',
};

export interface CubeImage {
  uri: string;
  artist: string;
  id: string;
  imageName: string;
}

export interface TagColor {
  color: string | null;
  tag: string;
}

export interface BoardDefinition {
  name: string;
  enabled: boolean;
}

// Display view options for cube list pages
export type CubeDisplayView = 'table' | 'spoiler' | 'curve' | 'stacks';

export interface ViewDefinition {
  name: string;
  boards: string[]; // Array of board keys to display in this view
  displayView: CubeDisplayView; // Default display mode
  defaultSorts: string[]; // 4 sort options
  defaultFilter?: string; // Optional default filter query
}

export interface CubeCards {
  mainboard: Card[];
  maybeboard: Card[];
  [boardName: string]: Card[]; // Support flexible boards
}

// Maximum number of boards allowed per cube
export const MAX_BOARDS = 12;

// Default board definitions for cubes (reflecting current functionality)
export const DEFAULT_BOARDS: BoardDefinition[] = [
  { name: 'Mainboard', enabled: true },
  { name: 'Maybeboard', enabled: true },
  { name: 'Basics', enabled: false },
  { name: 'Tokens', enabled: false },
];

/**
 * Gets the board definitions for a cube, using defaults if not specified
 */
export function getBoardDefinitions(cube: Cube): BoardDefinition[] {
  return cube.boards && cube.boards.length > 0 ? cube.boards : DEFAULT_BOARDS;
}

/**
 * Gets the enabled boards for a cube
 */
export function getEnabledBoards(cube: Cube): BoardDefinition[] {
  return getBoardDefinitions(cube).filter((board) => board.enabled);
}

/**
 * Converts a board name to a storage key (lowercase for compatibility)
 */
export function boardNameToKey(boardName: string): string {
  return boardName.toLowerCase().replace(/\s+/g, '');
}

/**
 * Gets the default boards for a new cube
 */
export function getNewCubeBoards(): BoardDefinition[] {
  return DEFAULT_BOARDS.map((board) => ({ ...board }));
}

/**
 * Validates board definitions
 */
export function validateBoardDefinitions(boards: BoardDefinition[]): { valid: boolean; error?: string } {
  if (boards.length > MAX_BOARDS) {
    return { valid: false, error: `Cannot have more than ${MAX_BOARDS} boards` };
  }

  if (boards.length === 0) {
    return { valid: false, error: 'Must have at least one board' };
  }

  // Check for duplicate board names (case-insensitive)
  const names = boards.map((b) => b.name.toLowerCase());
  const uniqueNames = new Set(names);
  if (names.length !== uniqueNames.size) {
    return { valid: false, error: 'Board names must be unique' };
  }

  // Check for empty names
  if (boards.some((b) => !b.name.trim())) {
    return { valid: false, error: 'Board names cannot be empty' };
  }

  return { valid: true };
}

// Maximum number of views allowed per cube
export const MAX_VIEWS = 20;

// Default sort options (same as CUBE_DEFAULT_SORTS in Sort.ts, duplicated to avoid circular import)
export const VIEW_DEFAULT_SORTS = ['Color Category', 'Types-Multicolor', 'Mana Value', 'Alphabetical'] as const;

// Default view definitions for cubes (reflecting current functionality)
export const DEFAULT_VIEWS: ViewDefinition[] = [
  {
    name: 'Mainboard',
    boards: ['mainboard'],
    displayView: 'table',
    defaultSorts: [...VIEW_DEFAULT_SORTS],
  },
  {
    name: 'Maybeboard',
    boards: ['maybeboard'],
    displayView: 'table',
    defaultSorts: [...VIEW_DEFAULT_SORTS],
  },
];

/**
 * Gets the view definitions for a cube, using defaults if not specified
 */
export function getViewDefinitions(cube: Cube): ViewDefinition[] {
  return cube.views && cube.views.length > 0 ? cube.views : DEFAULT_VIEWS;
}

/**
 * Gets a specific view by name
 */
export function getViewByName(cube: Cube, name: string): ViewDefinition | undefined {
  return getViewDefinitions(cube).find((v) => v.name.toLowerCase() === name.toLowerCase());
}

/**
 * Converts a view name to a URL-safe key
 */
export function viewNameToKey(viewName: string): string {
  return viewName.toLowerCase().replace(/\s+/g, '-');
}

/**
 * Gets the default views for a new cube
 */
export function getNewCubeViews(): ViewDefinition[] {
  return DEFAULT_VIEWS.map((view) => ({
    ...view,
    boards: [...view.boards],
    defaultSorts: [...view.defaultSorts],
  }));
}

/**
 * Validates view definitions
 */
export function validateViewDefinitions(views: ViewDefinition[]): { valid: boolean; error?: string } {
  if (views.length > MAX_VIEWS) {
    return { valid: false, error: `Cannot have more than ${MAX_VIEWS} views` };
  }

  if (views.length === 0) {
    return { valid: false, error: 'Must have at least one view' };
  }

  // Check for duplicate view names (case-insensitive)
  const names = views.map((v) => v.name.toLowerCase());
  const uniqueNames = new Set(names);
  if (names.length !== uniqueNames.size) {
    return { valid: false, error: 'View names must be unique' };
  }

  // Check for empty names
  if (views.some((v) => !v.name.trim())) {
    return { valid: false, error: 'View names cannot be empty' };
  }

  // Check that each view has at least one board
  if (views.some((v) => !v.boards || v.boards.length === 0)) {
    return { valid: false, error: 'Each view must have at least one board' };
  }

  // Check that defaultSorts has 4 elements
  if (views.some((v) => !v.defaultSorts || v.defaultSorts.length !== 4)) {
    return { valid: false, error: 'Each view must have exactly 4 sort options' };
  }

  return { valid: true };
}

export const CUBE_CATEGORIES = [
  'Vintage',
  'Legacy+',
  'Legacy',
  'Modern',
  'Premodern',
  'Pioneer',
  'Historic',
  'Standard',
  'Set',
  'Custom',
  'Bar',
];
export type CubeCategory = (typeof CUBE_CATEGORIES)[number];

export const CUBE_PREFIXES = [
  'Powered',
  'Unpowered',
  'Pauper',
  'Peasant',
  'Budget',
  'Silver-bordered',
  'Commander',
  'Battle Box',
  'Multiplayer',
  'Judge Tower',
  'Desert',
  'Twobert',
  'Rules Modified',
  'Color Restricted',
];

interface Cube {
  id: string;
  shortId: string;
  owner: User;
  name: string;
  visibility: string;
  priceVisibility: string;
  featured: boolean;
  categoryOverride?: CubeCategory;
  categoryPrefixes: any[];
  tagColors: TagColor[];
  defaultFormat: number;
  numDecks: number;
  description: string;
  brief?: string;
  imageName: string;
  date: number; // Legacy field - this is dateLastUpdated, kept for backwards compatibility
  dateCreated: number;
  dateLastUpdated: number;
  defaultSorts: string[];
  showUnsorted?: boolean;
  collapseDuplicateCards?: boolean;
  formats: DraftFormat[];
  following: string[];
  defaultStatus: CardStatus;
  defaultPrinting: string;
  disableAlerts: boolean;
  basics: string[]; // Deprecated - kept for backwards compatibility
  boards?: BoardDefinition[]; // Flexible board definitions
  views?: ViewDefinition[]; // View configurations for displaying cube content
  tags: any[];
  keywords: string[];
  cardCount: number;
  image: CubeImage;
  version: number;
}

export default Cube;
