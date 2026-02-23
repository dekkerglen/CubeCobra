import {
  BoardDefinition,
  boardNameToKey,
  validateBoardDefinitions,
  validateViewDefinitions,
} from '@utils/datatypes/Cube';
import { cubeDao } from 'dynamo/daos';
import { csrfProtection, ensureAuth } from 'router/middleware';
import cloudwatch from 'serverutils/cloudwatch';
import { isCubeViewable } from 'serverutils/cubefn';
import { redirect } from 'serverutils/render';

import { Request, Response } from '../../../types/express';

export const updateBoardsAndViewsHandler = async (req: Request, res: Response) => {
  try {
    // Parse JSON from form fields
    const boardsJson = req.body.boards;
    const viewsJson = req.body.views;

    let boards: BoardDefinition[];
    let views: any[];

    try {
      boards = JSON.parse(boardsJson);
      views = JSON.parse(viewsJson);
    } catch (_err) {
      req.flash('danger', 'Invalid data format');
      return redirect(req, res, `/cube/settings/${req.params.id}?view=boards-and-views`);
    }

    // Validate boards
    const boardValidation = validateBoardDefinitions(boards);
    if (!boardValidation.valid) {
      req.flash('danger', boardValidation.error || 'Invalid board configuration');
      return redirect(req, res, `/cube/settings/${req.params.id}?view=boards-and-views`);
    }

    // Ensure mainboard always exists
    const hasMainboard = boards.some((b) => boardNameToKey(b.name) === 'mainboard');
    if (!hasMainboard) {
      req.flash('danger', 'Mainboard is required and cannot be removed.');
      return redirect(req, res, `/cube/settings/${req.params.id}?view=boards-and-views`);
    }

    // Validate views
    const viewValidation = validateViewDefinitions(views);
    if (!viewValidation.valid) {
      req.flash('danger', viewValidation.error || 'Invalid view configuration');
      return redirect(req, res, `/cube/settings/${req.params.id}?view=boards-and-views`);
    }

    const cube = await cubeDao.getById(req.params.id!);

    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found.');
      return redirect(req, res, '/404');
    }

    if (!cube || cube.owner.id !== req.user!.id) {
      req.flash('danger', 'Unauthorized');
      return redirect(req, res, `/cube/settings/${req.params.id}?view=boards-and-views`);
    }

    // Check if any boards are referenced by views
    const boardKeys = boards.map((b) => boardNameToKey(b.name));
    const boardKeysSet = new Set(boardKeys);

    for (const view of views) {
      for (const viewBoard of view.boards) {
        if (!boardKeysSet.has(viewBoard)) {
          req.flash(
            'danger',
            `Cannot remove board referenced by view "${view.name}". Update or remove the view first.`,
          );
          return redirect(req, res, `/cube/settings/${req.params.id}?view=boards-and-views`);
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
      req.flash(
        'danger',
        'Internal error: Board update would result in data loss. Please try again or contact support.',
      );
      return redirect(req, res, `/cube/settings/${req.params.id}?view=boards-and-views`);
    }

    if (newCardCount !== oldCardCount) {
      cloudwatch.info(`Board update for cube ${cube.id}: card count changed from ${oldCardCount} to ${newCardCount}`);
    }

    // Save the reorganized cards structure
    await cubeDao.updateCards(cube.id, newCards);

    // Update the cube's views
    cube.views = views;
    await cubeDao.update(cube);

    req.flash('success', 'Boards and views updated successfully.');
    return redirect(req, res, `/cube/settings/${req.params.id}?view=boards-and-views`);
  } catch (err) {
    req.logger.error('Error updating boards and views:', err);
    req.flash('danger', 'Error updating boards and views: ' + (err as Error).message);
    return redirect(req, res, `/cube/settings/${req.params.id}?view=boards-and-views`);
  }
};

export const routes = [
  {
    path: '/:id',
    method: 'post',
    handler: [csrfProtection, ensureAuth, updateBoardsAndViewsHandler],
  },
];
