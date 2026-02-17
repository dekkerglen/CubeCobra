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

// Custom sort category - a tuple of [label, filter]
export interface CustomSortCategory {
  label: string;
  filter: string; // Filter syntax string to match cards
}

// Custom sort definition
export interface CustomSort {
  name: string; // Display name/label for this sort
  categories: CustomSortCategory[]; // Array of category tuples
  matchFirstOnly: boolean; // If true, match cards to first category only
}

export interface CubeCards {
  mainboard: Card[];
  maybeboard: Card[];
  [boardName: string]: Card[]; // Support flexible boards
}

// Maximum number of boards allowed per cube
export const MAX_BOARDS = 12;

// Default board definitions for cubes
export const DEFAULT_BOARDS: BoardDefinition[] = [{ name: 'Mainboard' }, { name: 'Maybeboard' }, { name: 'Basics' }];

/**
 * Gets the board definitions for a cube by deriving them from the cards structure.
 * If cards are not provided, returns DEFAULT_BOARDS.
 *
 * @param _cube - The cube object (unused now, kept for backwards compatibility)
 * @param cards - Optional cards structure to derive boards from (can be partial)
 * @returns Array of board definitions
 */
export function getBoardDefinitions(_cube: Cube, cards?: Record<string, Card[]> | CubeCards): BoardDefinition[] {
  if (!cards) {
    // No cards provided, return defaults
    return DEFAULT_BOARDS;
  }

  // Derive boards from cards object keys (excluding 'id' which might be present)
  const boardNames = Object.keys(cards).filter((key) => key !== 'id');

  if (boardNames.length === 0) {
    return DEFAULT_BOARDS;
  }

  // Convert board keys back to proper names (capitalize first letter)
  return boardNames.map((key) => ({
    name: key.charAt(0).toUpperCase() + key.slice(1),
  }));
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

// Default view definitions for cubes
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
  {
    name: 'Basics',
    boards: ['basics'],
    displayView: 'spoiler',
    defaultSorts: [...VIEW_DEFAULT_SORTS],
  },
];

/**
 * Gets the view definitions for a cube, using defaults if not specified
 */
export function getViewDefinitions(cube: Cube): ViewDefinition[] {
  if (cube.views && cube.views.length > 0) {
    return cube.views;
  }

  // Generate default views using cube's defaultSorts
  const cubeSorts = cube.defaultSorts && cube.defaultSorts.length === 4 ? cube.defaultSorts : [...VIEW_DEFAULT_SORTS];
  return DEFAULT_VIEWS.map((view) => ({
    ...view,
    boards: [...view.boards],
    defaultSorts: [...cubeSorts],
  }));
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
export function getNewCubeViews(defaultSorts?: string[]): ViewDefinition[] {
  const sorts = defaultSorts && defaultSorts.length === 4 ? defaultSorts : [...VIEW_DEFAULT_SORTS];
  return DEFAULT_VIEWS.map((view) => ({
    ...view,
    boards: [...view.boards],
    defaultSorts: [...sorts],
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
  const invalidSortView = views.find((v) => !v.defaultSorts || v.defaultSorts.length !== 4);
  if (invalidSortView) {
    return {
      valid: false,
      error: `View "${invalidSortView.name}" must have exactly 4 sort options (has ${invalidSortView.defaultSorts?.length || 0})`,
    };
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
  views?: ViewDefinition[]; // View configurations for displaying cube content
  customSorts?: CustomSort[]; // User-defined custom sort configurations
  tags: any[];
  keywords: string[];
  cardCount: number;
  image: CubeImage;
  version: number;
}

export default Cube;
