import { boardNameToKey, getBoardDefinitions, isReservedBoardKey } from '@utils/datatypes/Cube';
import { cubeDao } from 'dynamo/daos';
import { isCubeViewable } from 'serverutils/cubefn';

import { Request, Response } from '../../../../types/express';

// Returns the boards a cube actually has, as { value: key, label: name } options.
// Boards are derived from the cube's card file, so cube lists like mycubes can't
// supply them; add-to-cube pickers call this when a cube is selected instead of
// pulling the whole cube through cubeJSON. The list matches what addtocube accepts.
export const cubeBoardsHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      return res.status(400).send({ success: 'false', message: 'Cube ID is required' });
    }

    const cube = await cubeDao.getById(req.params.id);

    if (!cube || !isCubeViewable(cube, req.user)) {
      return res.status(404).send({ success: 'false', message: 'Not found' });
    }

    const cubeCards = await cubeDao.getCards(cube.id, cube, { populate: false });
    const boards = getBoardDefinitions(cube, cubeCards)
      .map((board) => ({ value: boardNameToKey(board.name), label: board.name }))
      .filter((board) => !isReservedBoardKey(board.value));

    return res.status(200).send({ success: 'true', boards });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).send({ success: 'false', message: 'Error retrieving cube boards' });
  }
};

export const routes = [
  {
    method: 'get',
    path: '/:id',
    handler: [cubeBoardsHandler],
  },
];
