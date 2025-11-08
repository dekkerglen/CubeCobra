import DraftType from '@utils/datatypes/Draft';
import Cube from '../../../dynamo/models/cube';
import Draft from '../../../dynamo/models/draft';
import { csrfProtection } from '../../../routes/middleware';
import { Request, Response } from '../../../types/express';
import { isCubeViewable } from '../../../util/cubefn';
import { setupPicks } from '@utils/draftutil';
import { handleRouteError, redirect } from '../../../util/render';

const handler = async (req: Request, res: Response) => {
  try {
    const base: DraftType = await Draft.getById(req.params.id);

    if (!base) {
      req.flash('danger', 'Deck not found');
      return redirect(req, res, '/404');
    }

    const seatParam = req.params.seat;
    if (!seatParam) {
      req.flash('danger', 'Seat parameter is required');
      return redirect(req, res, `/cube/deck/${req.params.id}`);
    }

    const seat = parseInt(seatParam, 10);
    if (!Number.isInteger(seat) || seat < 0 || seat >= base.seats.length) {
      req.flash('danger', 'Invalid seat index to redraft as.');
      return redirect(req, res, `/cube/deck/${req.params.id}`);
    }

    const cube = await Cube.getById(base.cube);
    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'The cube that this deck belongs to no longer exists.');
      return redirect(req, res, `/cube/deck/${req.params.id}`);
    }

    const draft: Omit<DraftType, 'id'> = {
      cube: base.cube,
      owner: req.user?.id,
      cubeOwner: cube.owner.id,
      date: new Date().valueOf(),
      type: base.type,
      InitialState: base.InitialState,
      basics: base.basics,
      cards: base.cards,
      seats: [],
      complete: false,
      name: '',
    };

    // Initialize seats array with the same length as the base draft
    for (let i = 0; i < base.seats.length; i += 1) {
      draft.seats.push({
        owner: i === 0 ? req.user?.id : undefined,
        mainboard: setupPicks(2, 8),
        sideboard: setupPicks(1, 8),
        pickorder: [],
        trashorder: [],
        name: base.seats[i]?.name || '',
        bot: base.seats[i]?.bot || false,
      });
    }

    const id = await Draft.put(draft);

    return redirect(req, res, `/draft/${id}`);
  } catch (err) {
    return handleRouteError(req, res, err, `/cube/playtest/${req.params.id}`);
  }
};

export const routes = [
  {
    path: '/:id',
    method: 'get',
    handler: [csrfProtection, handler],
  },
];
