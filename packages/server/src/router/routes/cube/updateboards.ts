import { boardNameToKey, validateBoardDefinitions } from '@utils/datatypes/Cube';
import { cubeDao } from 'dynamo/daos';
import { csrfProtection, ensureAuth } from 'router/middleware';
import { isCubeViewable } from 'serverutils/cubefn';

import { Request, Response } from '../../../types/express';

/**
 * Convert legacy basics (array of card IDs on cube) to cards in the "basics" board.
 * This is called when the user enables the Basics board and legacy basics exist.
 */
const migrateLegacyBasicsToBoard = async (cubeId: string, legacyBasics: string[]): Promise<void> => {
  const cubeCards = await cubeDao.getCards(cubeId);

  // Check if basics board already has cards
  const basicsKey = boardNameToKey('Basics');
  if (cubeCards[basicsKey] && cubeCards[basicsKey].length > 0) {
    // Already has cards, no need to migrate
    return;
  }

  // Convert legacy basics to card objects
  // Match the format used elsewhere (BulkUploadPage, EditCollapse, etc.)
  const basicsCards = legacyBasics.map((cardId) => ({
    cardID: cardId,
    tags: [] as string[],
    finish: 'Non-foil' as const,
    status: 'Owned' as const,
    addedTmsp: new Date().valueOf().toString(),
    notes: '',
  }));

  // Add basics board to the cards object
  cubeCards[basicsKey] = basicsCards;

  // Save the updated cards
  await cubeDao.updateCards(cubeId, cubeCards);
};

export const updateBoardsHandler = async (req: Request, res: Response) => {
  try {
    const { boards } = req.body;

    // Validate boards
    const validation = validateBoardDefinitions(boards);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.error || 'Invalid board configuration' });
    }

    const cube = await cubeDao.getById(req.params.id!);

    if (!isCubeViewable(cube, req.user)) {
      return res.status(404).json({ success: false, message: 'Cube not found.' });
    }

    if (!cube || cube.owner.id !== req.user!.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    // Check if Basics board is being enabled and there are legacy basics to migrate
    const basicsBoard = boards.find((b: { name: string; enabled: boolean }) => boardNameToKey(b.name) === 'basics');
    const oldBasicsBoard = cube.boards?.find((b) => boardNameToKey(b.name) === 'basics');

    // If Basics board is being enabled (wasn't enabled before or didn't exist) and we have legacy basics
    const basicsBeingEnabled = basicsBoard?.enabled && (!oldBasicsBoard || !oldBasicsBoard.enabled);
    if (basicsBeingEnabled && cube.basics && cube.basics.length > 0) {
      await migrateLegacyBasicsToBoard(cube.id, cube.basics);
      // Clear legacy basics after migration
      cube.basics = [];
    }

    // Update the cube's boards
    cube.boards = boards;

    await cubeDao.update(cube);
    return res.status(200).json({ success: true, message: 'Boards updated successfully.', boards: cube.boards });
  } catch (err) {
    req.logger.error('Error updating boards:', err);
    return res.status(500).json({ success: false, message: 'Error updating boards: ' + (err as Error).message });
  }
};

export const routes = [
  {
    path: '/:id',
    method: 'post',
    handler: [csrfProtection, ensureAuth, updateBoardsHandler],
  },
];
