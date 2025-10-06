import DraftType from 'datatypes/Draft';
import UserType from 'datatypes/User';

import Cube from '../../../dynamo/models/cube';
import Draft from '../../../dynamo/models/draft';
import Record from '../../../dynamo/models/record';
import User from '../../../dynamo/models/user';
import { csrfProtection } from '../../../routes/middleware';
import { Request, Response } from '../../../types/express';
import { abbreviate, isCubeViewable } from '../../../util/cubefn';
import generateMeta from '../../../util/meta';
import { handleRouteError, redirect, render } from '../../../util/render';
import util from '../../../util/util';

export const handler = async (req: Request, res: Response) => {
  try {
    const record = await Record.getById(req.params.id);

    if (!record) {
      req.flash('danger', 'Record not found');
      return redirect(req, res, '/404');
    }
    const cube = await Cube.getById(record.cube);

    if (!isCubeViewable(cube, req.user)) {
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
      draft = await Draft.getById(record.draft);
    }

    const baseUrl = util.getBaseUrl();
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
    return handleRouteError(req, res, err, `/`);
  }
};

export const routes = [
  {
    method: 'get',
    path: '/:id',
    handler: [csrfProtection, handler],
  },
];
