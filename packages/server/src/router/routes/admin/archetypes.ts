import { UserRoles } from '@utils/datatypes/User';
import type { ArchetypeName, ArchetypeNamesFile } from '@utils/drafting/topicArchetypes';
import { LEGACY_MODEL_VERSION } from '@utils/ml/modelBundle';
import { getBucketName, getObjectWithETag, putObjectIfMatch } from 'dynamo/s3client';
import { csrfProtection, ensureRole } from 'router/middleware';
import { redirectToAdminTab } from 'serverutils/adminDashboard';
import { archetypeNamesKey, readArchetypeFiles, readModelPointer } from 'serverutils/modelPointer';
import { Request, Response } from 'types/express';

export const MAX_ARCHETYPE_NAME_LENGTH = 40;

// The served version's topics and names, read fresh from S3 (the site's own copy is loaded at boot).
const loadServed = async () => {
  const bucket = getBucketName();
  const version = (await readModelPointer(bucket))?.version ?? LEGACY_MODEL_VERSION;
  const files = await readArchetypeFiles(bucket, version);
  return { bucket, version, files };
};

export const archetypesDataHandler = async (req: Request, res: Response) => {
  try {
    const { version, files } = await loadServed();
    return res.status(200).json({
      success: true,
      version,
      // cardTopics (every tagged card) is only needed to classify, not to name.
      topics: files?.topics.topics ?? [],
      names: files?.names.names ?? {},
    });
  } catch (error) {
    req.logger.error(`Loading archetypes failed: ${(error as Error).message}`);
    return res.status(500).json({ success: false, error: (error as Error).message });
  }
};

/** The trimmed name, or an error message when it can't be used. */
export const validateArchetypeName = (value: unknown): { name: string } | { error: string } => {
  if (typeof value !== 'string' || value.trim().length === 0) return { error: 'Names cannot be empty.' };
  const name = value.trim();
  if (name.length > MAX_ARCHETYPE_NAME_LENGTH) {
    return { error: `Names can be at most ${MAX_ARCHETYPE_NAME_LENGTH} characters.` };
  }
  return { name };
};

/**
 * Body: { version, names: { [topicId]: name } }. Writes model/<version>/archetypes/names.json, marking
 * each changed name as edited by this admin. Servers pick it up on their next restart.
 */
export const saveHandler = async (req: Request, res: Response) => {
  try {
    const { version, names } = req.body || {};
    if (typeof names !== 'object' || names === null || Array.isArray(names)) {
      return res.status(400).json({ success: false, error: 'Invalid names' });
    }

    const served = await loadServed();
    if (version !== served.version) {
      return res.status(409).json({ success: false, error: `The served version is now ${served.version}.` });
    }
    if (!served.files) {
      return res.status(400).json({ success: false, error: `${served.version} has no archetypes.` });
    }

    const topicIds = new Set(served.files.topics.topics.map((topic) => topic.id));
    const changes: Record<string, string> = {};
    for (const [topicId, value] of Object.entries(names as Record<string, unknown>)) {
      if (!topicIds.has(topicId)) {
        return res.status(400).json({ success: false, error: `Unknown archetype ${topicId}` });
      }
      const result = validateArchetypeName(value);
      if ('error' in result) {
        return res.status(400).json({ success: false, error: result.error });
      }
      changes[topicId] = result.name;
    }

    // Compare-and-swap, so two admins saving at once can't drop each other's edits.
    const key = archetypeNamesKey(served.version);
    const { value: current, etag } = await getObjectWithETag(served.bucket, key);
    const file = (current ?? served.files.names) as ArchetypeNamesFile;
    const now = Date.now();
    const updated: Record<string, ArchetypeName> = { ...file.names };
    for (const [topicId, name] of Object.entries(changes)) {
      const existing = updated[topicId];
      if (existing?.name === name) continue;
      updated[topicId] = {
        auto: existing?.auto ?? name,
        ...(existing?.llm !== undefined ? { llm: existing.llm } : {}),
        name,
        source: 'edited',
        editedBy: req.user!.id,
        editedAt: now,
      };
    }

    const next: ArchetypeNamesFile = { ...file, names: updated, updatedAt: now };
    if (!(await putObjectIfMatch(served.bucket, key, next, etag))) {
      return res.status(409).json({ success: false, error: 'Another save happened at the same time. Try again.' });
    }
    return res.status(200).json({ success: true, names: updated });
  } catch (error) {
    req.logger.error(`Saving archetype names failed: ${(error as Error).message}`);
    return res.status(500).json({ success: false, error: (error as Error).message });
  }
};

export const routes = [
  {
    method: 'get',
    path: '/',
    handler: [csrfProtection, ensureRole(UserRoles.ADMIN), redirectToAdminTab('archetypes')],
  },
  { method: 'get', path: '/data', handler: [csrfProtection, ensureRole(UserRoles.ADMIN), archetypesDataHandler] },
  { method: 'post', path: '/save', handler: [csrfProtection, ensureRole(UserRoles.ADMIN), saveHandler] },
];
