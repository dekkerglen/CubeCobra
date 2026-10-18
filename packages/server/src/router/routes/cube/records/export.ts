import DraftType from '@utils/datatypes/Draft';
import RecordType from '@utils/datatypes/Record';
import { RECORD_EXPORT_FORMAT, RECORD_EXPORT_VERSION, RecordExportFile } from '@utils/datatypes/RecordExport';
import { cubeDao, draftDao, recordDao } from 'dynamo/daos';
import { isCubeViewable } from 'serverutils/cubefn';
import { recordToExportEntry } from 'serverutils/recordExport';

import { Request, Response } from '../../../../types/express';

const DRAFT_BATCH_SIZE = 20;

const slugify = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'cube';

// Downloads a cube's records (or one record, with ?record=<id>) as a JSON file
// that the records import page can read back in. Anyone who can view the cube
// can export — the same data is already on its record pages.
export const exportRecordsHandler = async (req: Request, res: Response) => {
  try {
    const cube = await cubeDao.getById(req.params.id!);
    if (!cube || !isCubeViewable(cube, req.user)) {
      return res.status(404).send('Cube not found.');
    }

    const recordId = typeof req.query.record === 'string' ? req.query.record : undefined;
    const records: RecordType[] = [];
    if (recordId) {
      const record = await recordDao.getById(recordId);
      if (!record || record.cube !== cube.id) {
        return res.status(404).send('Record not found.');
      }
      records.push(record);
    } else {
      let lastKey: any = undefined;
      do {
        const result = await recordDao.getByCube(cube.id, 1000, lastKey);
        if (!result?.items) break;
        records.push(...result.items);
        lastKey = result.lastKey;
      } while (lastKey);
    }

    const draftById: Record<string, DraftType> = {};
    const draftIds = records.map((record) => record.draft).filter((id): id is string => !!id);
    for (let i = 0; i < draftIds.length; i += DRAFT_BATCH_SIZE) {
      const drafts = (await draftDao.batchGet(draftIds.slice(i, i + DRAFT_BATCH_SIZE))) as DraftType[];
      for (const draft of drafts) if (draft) draftById[draft.id] = draft;
    }

    const file: RecordExportFile = {
      format: RECORD_EXPORT_FORMAT,
      version: RECORD_EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      source: { cubeId: cube.id, cubeName: cube.name },
      records: records
        .sort((a, b) => a.date - b.date)
        .map((record) => recordToExportEntry(record, record.draft ? draftById[record.draft] : undefined)),
    };

    const filename =
      records.length === 1 && recordId
        ? `${slugify(cube.name)}-${slugify(records[0]!.name)}.json`
        : `${slugify(cube.name)}-records.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(JSON.stringify(file, null, 2));
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).send('Error exporting records.');
  }
};

export const routes = [
  {
    method: 'get',
    path: '/:id',
    handler: [exportRecordsHandler],
  },
];
