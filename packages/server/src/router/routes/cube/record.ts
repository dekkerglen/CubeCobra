import DraftType from '@utils/datatypes/Draft';
import UserType from '@utils/datatypes/User';
import { cubeDao, draftDao } from 'dynamo/daos';
import Record from 'dynamo/models/record';
import User from 'dynamo/models/user';
import { abbreviate, isCubeViewable } from 'serverutils/cubefn';
import generateMeta from 'serverutils/meta';
import { handleRouteError, redirect, render } from 'serverutils/render';
import { getBaseUrl } from 'serverutils/util';

import { Request, Response } from '../../../types/express';

export const handler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      req.flash('danger', 'Invalid record ID');
      return redirect(req, res, '/404');
    }

    const record = await Record.getById(req.params.id);

    if (!record) {
      req.flash('danger', 'Record not found');
      return redirect(req, res, '/404');
    }
    const cube = await cubeDao.getById(record.cube);

    if (!cube || !isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }

    let players: UserType[] = [];

    const playerIds = record.players.map((player) => player.userId).filter((id) => id !== undefined);
    if (playerIds.length > 0) {
      const result = await User.batchGet(playerIds);

      players = result.filter((user: UserType) => user !== undefined) as UserType[];
    }

    let draft: DraftType | undefined;
    if (record.draft) {
      draft = await draftDao.getById(record.draft);
    }

    const baseUrl = getBaseUrl();
    return render(
      req,
      res,
      'RecordPage',
      {
        cube,
        record,
        players,
        draft,
      },
      {
        title: `${abbreviate(cube.name)} - ${record.name}`,
        metadata: generateMeta(
          `Cube Cobra Record: ${record.name}`,
          record.description,
          cube.image.uri,
          `${baseUrl}/cube/record/${req.params.id}`,
        ),
      },
    );
  } catch (err) {
    return handleRouteError(req, res, err as Error, `/`);
  }
};

export const routes = [
  {
    method: 'get',
    path: '/:id',
    handler: [handler],
  },
];
