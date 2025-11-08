import commentModel from '../../../../dynamo/models/comment';
import Cube from '../../../../dynamo/models/cube';
import p1p1PackModel from '../../../../dynamo/models/p1p1Pack';
import { csrfProtection, ensureAuth } from '../../../../routes/middleware';
import { Request, Response } from '../../../../types/express';
import { isValidUUID } from '../../../../util/validation';

export const deleteP1P1Handler = async (req: Request, res: Response) => {
  try {
    const { packId } = req.body;
    const { user } = req;

    if (!packId) {
      return res.status(400).json({ error: 'Pack ID is required' });
    }

    // Validate UUID format
    if (!isValidUUID(packId)) {
      return res.status(400).json({ error: 'Invalid pack ID format' });
    }

    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get the pack to check permissions
    const pack = await p1p1PackModel.getById(packId);
    if (!pack) {
      return res.status(404).json({ error: 'P1P1 pack not found' });
    }

    // Prevent deletion of packs created by CubeCobra (daily P1P1 packs)
    if (pack.createdBy === 'CubeCobra') {
      return res.status(403).json({ error: 'Cannot delete official daily P1P1 packs' });
    }

    // Check if user has permission to delete (cube owner or pack creator)
    const cube = await Cube.getById(pack.cubeId);
    const isCubeOwner = cube && cube.owner && cube.owner.id === user.id;
    const isPackCreator = pack.createdBy === user.id;

    if (!isCubeOwner && !isPackCreator) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    // Delete associated data first
    try {
      // Votes are embedded in pack and will be deleted with the pack

      // Delete all comments for this pack
      let lastKey;
      do {
        const result = await commentModel.queryByParentAndType(packId, lastKey);
        if (result.items && result.items.length > 0) {
          for (const comment of result.items) {
            await commentModel.delete({ id: comment.id });
          }
        }
        lastKey = result.lastKey;
      } while (lastKey);
    } catch (deleteError) {
      // Log but don't fail the operation if cleanup fails
      req.logger.error(`Failed to clean up P1P1 data for pack ${packId}:`, deleteError);
    }

    // Delete the pack itself
    await p1p1PackModel.deleteById(packId);

    return res.status(200).json({ success: true });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).json({ error: 'Error deleting P1P1 pack' });
  }
};

export const routes = [
  {
    method: 'delete',
    path: '/',
    handler: [ensureAuth, csrfProtection, deleteP1P1Handler],
  },
];
