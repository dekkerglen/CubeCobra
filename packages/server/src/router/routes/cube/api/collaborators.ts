import { getCubeId, isCubeOwner } from '@utils/Util';
import { collaboratorIndexDao, cubeDao, userDao } from 'dynamo/daos';
import { ensureAuth } from 'router/middleware';
import { isCubeViewable } from 'serverutils/cubefn';
import { addNotification, isAdmin } from 'serverutils/util';

import { Request, Response } from '../../../../types/express';

const MAX_COLLABORATORS = 20;
const MAX_COLLABORATORS_MESSAGE = `This cube has reached the maximum of ${MAX_COLLABORATORS} collaborators`;

const toUserSummary = (u: { id: string; username: string; image?: { uri?: string } }) => ({
  id: u.id,
  username: u.username,
  imageUri: u.image?.uri ?? null,
});

/**
 * GET /cube/api/collaborators/:id
 *
 * Returns the list of collaborators (id, username, imageUri) for a cube.
 * Viewable by anyone who can view the cube. The owner (or an admin) also
 * receives the users with a pending invite under `pending`.
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
    const users = await userDao.batchGet(collaboratorIds);

    const collaborators = users.map(toUserSummary);

    if (!isCubeOwner(cube, req.user) && !(req.user && isAdmin(req.user))) {
      return res.status(200).json({ success: 'true', collaborators });
    }

    const invites = await cubeDao.queryInvitesForCube(cube.id);
    const pendingUsers = invites.length > 0 ? await userDao.batchGet(invites.map((invite) => invite.userId)) : [];
    const pending = pendingUsers.map(toUserSummary);

    return res.status(200).json({ success: 'true', collaborators, pending });
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
 * Invites a user to collaborate on the cube. Only the owner may do this. The
 * invitee is not added to the cube until they accept the invite.
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

    // Only the owner (or admins) can add collaborators
    if (!isCubeOwner(cube, req.user) && !isAdmin(req.user!)) {
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

    if (await cubeDao.getInvite(cube.id, targetUser.id)) {
      return res.status(400).json({ success: 'false', message: 'That user already has a pending invite' });
    }

    const pendingInvites = await cubeDao.queryInvitesForCube(cube.id);
    if (cube.collaborators.length + pendingInvites.length >= MAX_COLLABORATORS) {
      return res.status(400).json({ success: 'false', message: MAX_COLLABORATORS_MESSAGE });
    }

    await cubeDao.writeInvite(cube.id, targetUser.id, req.user!.id);
    await addNotification(
      targetUser,
      req.user!,
      `/user/collaborations/${targetUser.id}`,
      `${req.user!.username} invited you to collaborate on "${cube.name}"`,
    );

    return res.status(200).json({ success: 'true', invite: toUserSummary(targetUser) });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).json({ success: 'false', message: 'Error inviting collaborator' });
  }
};

/**
 * POST /cube/api/collaborators/:id/invite/accept
 *
 * Accepts the requester's pending invite, adding them as a collaborator. This
 * deliberately skips the viewability check: an invitee to a private cube can't
 * view it until they have accepted.
 */
export const acceptInviteHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      return res.status(400).json({ success: 'false', message: 'Cube ID is required' });
    }
    const cubeId = req.params.id;
    const invitee = req.user!;

    const invite = await cubeDao.getInvite(cubeId, invitee.id);
    if (!invite) {
      return res.status(403).json({ success: 'false', message: 'No pending invite' });
    }

    const cube = await cubeDao.getById(cubeId);
    if (!cube) {
      await cubeDao.deleteInvite(cubeId, invitee.id);
      return res.status(404).json({ success: 'false', message: 'Cube not found' });
    }

    if (cube.collaborators.includes(invitee.id)) {
      await cubeDao.deleteInvite(cube.id, invitee.id);
      return res.status(200).json({ success: 'true' });
    }

    if (cube.collaborators.length >= MAX_COLLABORATORS) {
      return res.status(400).json({ success: 'false', message: MAX_COLLABORATORS_MESSAGE });
    }

    cube.collaborators = [...cube.collaborators, invitee.id];
    await cubeDao.update(cube);
    await collaboratorIndexDao.add(invitee.id, cube.id);
    await cubeDao.deleteInvite(cube.id, invitee.id);

    const owner = await userDao.getById(cube.owner.id);
    if (owner) {
      await addNotification(
        owner,
        invitee,
        `/cube/list/${encodeURIComponent(getCubeId(cube))}`,
        `${invitee.username} accepted your invite to collaborate on "${cube.name}"`,
      );
    }

    return res.status(200).json({ success: 'true' });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).json({ success: 'false', message: 'Error accepting invite' });
  }
};

/**
 * POST /cube/api/collaborators/:id/invite/decline
 *
 * Declines (deletes) the requester's pending invite. Nobody is notified.
 */
export const declineInviteHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      return res.status(400).json({ success: 'false', message: 'Cube ID is required' });
    }
    const cubeId = req.params.id;
    const userId = req.user!.id;

    const invite = await cubeDao.getInvite(cubeId, userId);
    if (!invite) {
      return res.status(403).json({ success: 'false', message: 'No pending invite' });
    }

    await cubeDao.deleteInvite(cubeId, userId);

    return res.status(200).json({ success: 'true' });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).json({ success: 'false', message: 'Error declining invite' });
  }
};

/**
 * DELETE /cube/api/collaborators/:id/invite/:userId
 *
 * Cancels a pending invite. Only the owner (or an admin) may do this.
 */
export const cancelInviteHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      return res.status(400).json({ success: 'false', message: 'Cube ID is required' });
    }
    const cube = await cubeDao.getById(req.params.id);

    if (!cube || !isCubeViewable(cube, req.user)) {
      return res.status(404).json({ success: 'false', message: 'Cube not found' });
    }

    if (!isCubeOwner(cube, req.user) && !isAdmin(req.user!)) {
      return res.status(403).json({ success: 'false', message: 'Only the cube owner can manage collaborators' });
    }

    const userId = req.params.userId;
    if (!userId) {
      return res.status(400).json({ success: 'false', message: 'User ID is required' });
    }

    await cubeDao.deleteInvite(cube.id, userId);

    return res.status(200).json({ success: 'true' });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).json({ success: 'false', message: 'Error cancelling invite' });
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
    const isOwner = isCubeOwner(cube, req.user) || isAdmin(req.user!);
    const isSelf = req.user && req.user.id === userId;

    // Owner (or admin) can remove anyone; a collaborator can only remove themselves
    if (!isOwner && !isSelf) {
      return res.status(403).json({ success: 'false', message: 'Only the cube owner can remove other collaborators' });
    }

    if (!cube.collaborators.includes(userId)) {
      return res.status(200).json({ success: 'true' });
    }

    cube.collaborators = cube.collaborators.filter((id) => id !== userId);
    await cubeDao.update(cube);
    await collaboratorIndexDao.remove(userId, cube.id);

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
  // Invite routes grouped before the remove route for readability.
  {
    method: 'post' as const,
    path: '/:id/invite/accept',
    handler: [ensureAuth, acceptInviteHandler],
  },
  {
    method: 'post' as const,
    path: '/:id/invite/decline',
    handler: [ensureAuth, declineInviteHandler],
  },
  {
    method: 'delete' as const,
    path: '/:id/invite/:userId',
    handler: [ensureAuth, cancelInviteHandler],
  },
  {
    method: 'delete' as const,
    path: '/:id/:userId',
    handler: [ensureAuth, removeCollaboratorHandler],
  },
];
