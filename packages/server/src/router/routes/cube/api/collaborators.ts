import { cubeDao, userDao } from 'dynamo/daos';
import { ensureAuth } from 'router/middleware';
import { isCubeViewable } from 'serverutils/cubefn';

import { Request, Response } from '../../../../types/express';

/**
 * GET /cube/api/collaborators/:id
 *
 * Returns the list of collaborators (id, username, imageName) for a cube.
 * Viewable by anyone who can view the cube.
 */
export const listCollaboratorsHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      return res.status(400).json({ success: 'false', message: 'Cube ID is required' });
    }
    const cube = await cubeDao.getById(req.params.id);

    if (!cube || !isCubeViewable(cube, req.user)) {
      return res.status(404).json({ success: 'false', message: 'Cube not found' });
    }

    const collaboratorIds = cube.collaborators ?? [];
    const users = await Promise.all(collaboratorIds.map((id) => userDao.getById(id)));

    const collaborators = users
      .filter((u): u is NonNullable<typeof u> => u !== null && u !== undefined)
      .map((u) => ({ id: u.id, username: u.username, imageUri: u.image?.uri ?? null }));

    return res.status(200).json({ success: 'true', collaborators });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).json({ success: 'false', message: 'Error listing collaborators' });
  }
};

/**
 * POST /cube/api/collaborators/:id/add
 * Body: { username: string }
 *
 * Adds a user as a collaborator on the cube. Only the owner may do this.
 */
export const addCollaboratorHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      return res.status(400).json({ success: 'false', message: 'Cube ID is required' });
    }
    const cube = await cubeDao.getById(req.params.id);

    if (!cube || !isCubeViewable(cube, req.user)) {
      return res.status(404).json({ success: 'false', message: 'Cube not found' });
    }

    // Only the owner can add collaborators
    if (!req.user || cube.owner.id !== req.user.id) {
      return res.status(403).json({ success: 'false', message: 'Only the cube owner can manage collaborators' });
    }

    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ success: 'false', message: 'username is required' });
    }

    const targetUser = await userDao.getByUsername(username);
    if (!targetUser) {
      return res.status(404).json({ success: 'false', message: 'User not found' });
    }

    if (targetUser.id === cube.owner.id) {
      return res.status(400).json({ success: 'false', message: 'That user is already the owner of this cube' });
    }

    if (cube.collaborators.includes(targetUser.id)) {
      return res.status(400).json({ success: 'false', message: 'That user is already a collaborator' });
    }

    if (cube.collaborators.length >= 20) {
      return res
        .status(400)
        .json({ success: 'false', message: 'This cube has reached the maximum of 20 collaborators' });
    }

    cube.collaborators = [...cube.collaborators, targetUser.id];
    await cubeDao.update(cube);

    // Best-effort: sync collaboratingCubes on the user doc for dashboard display.
    // If this fails the user still has edit access (cube.collaborators is authoritative).
    try {
      targetUser.collaboratingCubes = [...(targetUser.collaboratingCubes ?? []), cube.id];
      await userDao.update(targetUser);
    } catch (syncErr) {
      const e = syncErr as Error;
      req.logger.error(`Failed to sync collaboratingCubes for user ${targetUser.id}: ${e.message}`);
    }

    return res.status(200).json({
      success: 'true',
      collaborator: { id: targetUser.id, username: targetUser.username, imageUri: targetUser.image?.uri ?? null },
    });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).json({ success: 'false', message: 'Error adding collaborator' });
  }
};

/**
 * DELETE /cube/api/collaborators/:id/:userId
 *
 * Removes a collaborator from the cube.
 * Only the owner can remove others; a collaborator may remove themselves.
 */
export const removeCollaboratorHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      return res.status(400).json({ success: 'false', message: 'Cube ID is required' });
    }
    const cube = await cubeDao.getById(req.params.id);

    if (!cube || !isCubeViewable(cube, req.user)) {
      return res.status(404).json({ success: 'false', message: 'Cube not found' });
    }

    const userId = req.params.userId ?? '';
    const isOwner = req.user && cube.owner.id === req.user.id;
    const isSelf = req.user && req.user.id === userId;

    // Owner can remove anyone; a collaborator can only remove themselves
    if (!isOwner && !isSelf) {
      return res.status(403).json({ success: 'false', message: 'Only the cube owner can remove collaborators' });
    }

    if (!cube.collaborators.includes(userId)) {
      return res.status(400).json({ success: 'false', message: `User ${userId} is not a collaborator on this cube` });
    }

    cube.collaborators = cube.collaborators.filter((id) => id !== userId);
    await cubeDao.update(cube);

    // Best-effort: sync collaboratingCubes on the user doc.
    try {
      const removedUser = await userDao.getById(userId);
      if (removedUser) {
        removedUser.collaboratingCubes = (removedUser.collaboratingCubes ?? []).filter((id) => id !== cube.id);
        await userDao.update(removedUser);
      }
    } catch (syncErr) {
      const e = syncErr as Error;
      req.logger.error(`Failed to sync collaboratingCubes for user ${userId}: ${e.message}`);
    }

    return res.status(200).json({ success: 'true' });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).json({ success: 'false', message: 'Error removing collaborator' });
  }
};

export const routes = [
  {
    method: 'get' as const,
    path: '/:id',
    handler: [listCollaboratorsHandler],
  },
  {
    method: 'post' as const,
    path: '/:id/add',
    handler: [ensureAuth, addCollaboratorHandler],
  },
  {
    method: 'delete' as const,
    path: '/:id/:userId',
    handler: [ensureAuth, removeCollaboratorHandler],
  },
];
