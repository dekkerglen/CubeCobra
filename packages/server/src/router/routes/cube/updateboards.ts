import { BoardDefinition, boardNameToKey, validateBoardDefinitions } from '@utils/datatypes/Cube';
import { cubeDao } from 'dynamo/daos';
import { csrfProtection, ensureAuth } from 'router/middleware';
import cloudwatch from 'serverutils/cloudwatch';
import { isCubeViewable } from 'serverutils/cubefn';

import { Request, Response } from '../../../types/express';

export const updateBoardsHandler = async (req: Request, res: Response) => {
  try {
    const { boards } = req.body as { boards: BoardDefinition[] };

    // Validate boards
    const validation = validateBoardDefinitions(boards);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.error || 'Invalid board configuration' });
    }

    // Ensure mainboard always exists
    const hasMainboard = boards.some((b) => boardNameToKey(b.name) === 'mainboard');
    if (!hasMainboard) {
      return res.status(400).json({
        success: false,
        message: 'Mainboard is required and cannot be removed.',
      });
    }

    const cube = await cubeDao.getById(req.params.id!);

    if (!isCubeViewable(cube, req.user)) {
      return res.status(404).json({ success: false, message: 'Cube not found.' });
    }

    if (!cube || cube.owner.id !== req.user!.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    // Check if any boards are referenced by views
    const boardKeys = boards.map((b) => boardNameToKey(b.name));
    const boardKeysSet = new Set(boardKeys);
    const views = cube.views || [];

    for (const view of views) {
      for (const viewBoard of view.boards) {
        if (!boardKeysSet.has(viewBoard)) {
          return res.status(400).json({
            success: false,
            message: `Cannot remove board referenced by view "${view.name}". Update or remove the view first.`,
          });
        }
      }
    }

    // Get current cards to reorganize boards
    const currentCards = await cubeDao.getCards(cube.id);

    // Build new cards structure based on the requested boards
    const newCards: any = {};

    for (const board of boards) {
      const key = boardNameToKey(board.name);
      // Keep existing cards for this board, or initialize empty array
      newCards[key] = currentCards[key] || [];
    }

    // Handle cards from removed boards - move them to mainboard
    const newBoardKeys = new Set(boards.map((b: BoardDefinition) => boardNameToKey(b.name)));
    for (const [oldKey, cards] of Object.entries(currentCards)) {
      if (oldKey !== 'id' && !newBoardKeys.has(oldKey) && Array.isArray(cards) && cards.length > 0) {
        // This board was removed and has cards - move to mainboard
        cloudwatch.info(`Moving ${cards.length} cards from removed board '${oldKey}' to mainboard`);
        newCards.mainboard = [...(newCards.mainboard || []), ...cards];
      }
    }

    // Update indices for all cards in all boards
    for (const [boardKey, boardCards] of Object.entries(newCards)) {
      if (Array.isArray(boardCards)) {
        boardCards.forEach((card: any, index: number) => {
          card.board = boardKey;
          card.index = index;
        });
      }
    }

    // Safety check: ensure we're not accidentally wiping all cards
    const oldCardCount = Object.values(currentCards)
      .filter((val) => Array.isArray(val))
      .reduce((sum, arr) => sum + arr.length, 0);
    const newCardCount = Object.values(newCards)
      .filter((val) => Array.isArray(val))
      .reduce((sum, arr) => sum + arr.length, 0);

    if (oldCardCount > 0 && newCardCount === 0) {
      cloudwatch.error(
        `Prevented data loss: Board update would have deleted all ${oldCardCount} cards for cube ${cube.id}`,
      );
      return res.status(500).json({
        success: false,
        message: 'Internal error: Board update would result in data loss. Please try again or contact support.',
      });
    }

    if (newCardCount !== oldCardCount) {
      cloudwatch.info(`Board update for cube ${cube.id}: card count changed from ${oldCardCount} to ${newCardCount}`);
    }

    // Save the reorganized cards structure
    await cubeDao.updateCards(cube.id, newCards);

    return res.status(200).json({
      success: true,
      message: 'Boards updated successfully.',
      redirect: `/cube/settings/${cube.id}?view=boards-and-views`,
    });
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
