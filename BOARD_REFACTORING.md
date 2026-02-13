# Board Refactoring Progress

This document tracks the ongoing refactoring to make cube boards configurable and flexible.

## Goal

Make boards configurable with meaningful defaults that reflect current functionality:

- Default boards: Mainboard, Maybeboard, Basics (not visible), Tokens (not visible)
- New cubes start with all four boards enabled
- Allow customization of names, order, and visibility

## Completed Changes

### 1. Data Type Definitions ✅

**File: `packages/utils/src/datatypes/Cube.ts`**

- Added `BoardDefinition` interface with `name` and `enabled` fields
- Added `boards?: BoardDefinition[]` field to Cube interface
- Made `CubeCards` interface flexible with index signature to support dynamic boards
- Added helper functions:
  - `DEFAULT_BOARDS` - the fallback board configuration
  - `getBoardDefinitions(cube)` - gets boards with fallback to defaults
  - `getEnabledBoards(cube)` - filters to only enabled boards
  - `boardNameToKey(boardName)` - converts display name to storage key
  - `getNewCubeBoards()` - returns default boards for new cubes
- Marked `basics: string[]` as deprecated with comment

**File: `packages/utils/src/datatypes/Card.ts`**

- Extended `BoardType` to allow dynamic board names: `type BoardType = ... | string`
- Made `Changes` interface flexible with index signature to support dynamic boards
- Kept mainboard/maybeboard as explicit fields for backwards compatibility

### 2. Cube DAO Updates ✅

**File: `packages/server/src/dynamo/dao/CubeDynamoDao.ts`**

- Added `boards?: any[]` to `UnhydratedCube` interface
- Updated `dehydrateItem()` to include boards field
- Hydration methods automatically handle boards via spread operator
- Updated `getCards()` to count cards across all boards dynamically
- Updated `updateCards()` to handle flexible boards
- Updated `getCubeCardsVersion()` to count all boards

**File: `packages/server/test/test-utils/data.ts`**

- Updated `createCube()` test helper to include all four boards enabled by default

### 3. Draft System Updates ✅

**File: `packages/utils/src/datatypes/Draft.ts`**

- Added `basicsBoard?: string` to `DraftFormat` interface
- Added `basicsBoard?: string` to `Draft` interface
- Marked `basics: number[]` as deprecated with comment

**File: `packages/utils/src/drafting/createdraft.ts`**

- Updated `createDraft()` to set `basicsBoard` field (defaults to 'Basics')
- Set `basicsBoard` from format's `basicsBoard` field if present

### 4. Cube Editing Infrastructure ✅

**API Endpoints Updated:**

- **`packages/server/src/router/routes/cube/api/cubecardnames.ts`**

  - Now accepts any board name as parameter
  - Validates board against cube's board definitions
  - Converts board names to storage keys using `boardNameToKey()`
  - Returns helpful error message with valid board names

- **`packages/server/src/router/routes/cube/api/addtocube.ts`**
  - Accepts flexible board names
  - Validates against cube's boards
  - Uses `boardNameToKey()` for storage consistency

**UI Components Updated:**

- **`packages/client/src/components/cube/CubeListEditSidebar.tsx`**

  - Board selector now dynamically populated from cube's boards
  - Uses `getBoardDefinitions()` and `boardNameToKey()`
  - Supports all custom boards

- **`packages/client/src/components/modals/AddToCubeModal.tsx`**
  - Board selector dynamically populated based on selected cube
  - Falls back to mainboard/maybeboard if cube not found
  - Updates board options when cube selection changes

## Remaining Work

### 4. Board Customization UI (Not Started)

**Priority: High**

- [ ] Create `BoardSettingsModal` component
  - Board list with drag-and-drop reordering
  - Enable/disable toggles
  - Rename functionality (with warning about card preservation)
  - Add/remove board buttons
- [ ] Add gear menu option to open board settings
- [ ] Handle renaming:
  - When renaming, need to migrate cards from old board key to new board key
  - Show confirmation dialog explaining impact
  - Consider versioning to handle backwards compatibility

### 5. Deckbuilder and Draft Construction (Not Started)

**Priority: High**

- [ ] Update deckbuilder to pull basics from the configured basics board
- [ ] Fallback logic: if basics board is empty, use legacy `cube.basics` field
- [ ] Update draft construction to reference basics board
- [ ] Handle case where basics board doesn't exist in cube

### 6. Cube Editing Logic (Completed)

**Priority: High**

✅ **Completed Updates:**

- ✅ Updated CubeDynamoDao card storage methods
  - `getCards()` now counts cards across all boards
  - `updateCards()` handles flexible boards dynamically
  - `getCubeCardsVersion()` updated for all boards
- ✅ API endpoints support flexible boards
  - `cubecardnames` API validates and accepts any board
  - `addtocube` API validates boards against cube definitions
- ✅ UI components updated
  - `CubeListEditSidebar` board selector is dynamic
  - `AddToCubeModal` board selector based on cube

**Remaining Work:**

- [ ] Update `packages/server/src/router/routes/cube/api/updatecard.ts` (if exists)
  - Support adding/removing cards from dynamic boards
  - Update board parameter validation
- [ ] Update `packages/server/src/router/routes/cube/api/updatecards.ts` (if exists)
  - Batch operations with flexible boards
- [ ] Update `packages/server/src/serverutils/changelog.ts`
  - Update changelog to handle dynamic board names
  - Keep existing mainboard/maybeboard logic for backwards compatibility

### 7. UI Component Updates (Not Started)

**Priority: Medium**

**Files to Update:**

- [ ] `packages/client/src/pages/CubeListPage.tsx`
  - Display all enabled boards instead of hardcoded mainboard/maybeboard
  - Use `getEnabledBoards(cube)` to get board list
- [ ] `packages/client/src/components/cube/CubeListEditSidebar.tsx`
  - Board selector should use dynamic board list
  - Update options to use `getBoardDefinitions(cube)`
- [ ] `packages/client/src/components/modals/AddToCubeModal.tsx`
  - Board selector should use enabled boards
- [ ] `packages/client/src/components/cube/CubeSidebar.tsx`
  - Update sidebar to show all enabled boards
  - Remove hardcoded Mainboard/Maybeboard subitems

### 8. API and Route Updates (Not Started)

**Priority: High**

**Files to Check:**

- [ ] `packages/server/src/router/routes/cube/api/cubecardnames.ts`
  - Board parameter should accept any board name
  - Validate against cube's boards
- [ ] `packages/server/src/router/routes/cube/download.ts`
  - Update download formats to support all boards
- [ ] `packages/server/src/router/routes/cube/api/cubeJSON.ts`
  - Ensure JSON export includes all boards
- [ ] All routes that filter by board - validate against cube's boards

### 9. Draft Format Custom Syntax (Not Started)

**Priority: Medium**

- [ ] Extend slot filter syntax to support `board:BoardName`
- [ ] Update `packages/utils/src/drafting/draftFilter.ts`
- [ ] Add support for pulling from multiple boards: `board:Basics,board:Tokens`
- [ ] Update pack creation logic to resolve board references
- [ ] Update CustomPackCard documentation

### 10. Search and Replace mainboard/maybeboard References (Not Started)

**Priority: Low - Do Last**

- [ ] Search codebase for hardcoded "mainboard" and "maybeboard" strings
- [ ] Update to use cube context where appropriate
- [ ] Keep deck-related mainboard/sideboard references unchanged
- [ ] Update analytics to handle flexible boards

## Migration Strategy

### For Existing Cubes (No `boards` field)

- Use `DEFAULT_BOARDS` as fallback
- Basics and Tokens disabled by default (hidden)
- Mainboard and Maybeboard enabled

### For New Cubes

- Initialize with all four boards enabled
- Use `getNewCubeBoards()` helper

### Card Storage Migration

- Existing cards in mainboard/maybeboard stay in those keys
- New boards use lowercase keys: `boardNameToKey()`
- Example: "Basics" → "basics", "Tokens" → "tokens"

## Testing Checklist

### Unit Tests

- [ ] Test helper functions in Cube.ts
- [ ] Test board validation
- [ ] Test board key conversion
- [ ] Test migration from undefined boards

### Integration Tests

- [ ] Create cube with custom boards
- [ ] Rename board and verify cards persist
- [ ] Disable/enable boards
- [ ] Draft with basics board
- [ ] Download cube with multiple boards

### Edge Cases

- [ ] Empty boards array
- [ ] Duplicate board names
- [ ] Special characters in board names
- [ ] Board name collisions after key conversion
- [ ] Very long board names

## Notes and Considerations

1. **Backwards Compatibility**: The `basics` field is deprecated but kept for old cubes with empty basics board
2. **Board Keys**: Board names are converted to keys using `boardNameToKey()` for storage consistency
3. **Deck vs Cube**: Keep deck mainboard/sideboard separate from cube boards
4. **Performance**: Board operations should be efficient - avoid O(n) lookups where possible
5. **Validation**: Ensure board names are validated (non-empty, reasonable length, no special chars that break storage)

## Open Questions

1. **Board Limits**: Should there be a max number of boards per cube?
2. **Reserved Names**: Should we prevent using "mainboard", "sideboard", "deck" as custom board names?
3. **Board Icons**: Should boards have optional icons/colors?
4. **Default Board**: Should cubes have a "default" board for new cards?
5. **Board Permissions**: Should board visibility be tied to cube visibility or independent?
