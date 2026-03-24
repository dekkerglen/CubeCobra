import CubeFn from 'serverutils/cubefn';
import * as util from 'serverutils/util';

import { createCube, createUser } from '../test-utils/data';

jest.mock('serverutils/util');
jest.mock('serverutils/carddb', () => ({
  cardFromId: jest.fn(),
  getReasonableById: jest.fn(),
  getMostReasonable: jest.fn(),
  reasonableId: jest.fn(),
  getAllVersionIds: jest.fn(),
}));

const { isCubeEditable } = CubeFn;

describe('isCubeEditable — collaborators', () => {
  beforeEach(() => {
    (util.isAdmin as jest.Mock).mockReturnValue(false);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns true for the cube owner', () => {
    const owner = createUser({ id: 'owner-1' });
    const cube = createCube({ owner, collaborators: [] });
    expect(isCubeEditable(cube, owner)).toBe(true);
  });

  it('returns false when user is null', () => {
    const owner = createUser({ id: 'owner-1' });
    const cube = createCube({ owner, collaborators: [] });
    expect(isCubeEditable(cube, null)).toBe(false);
  });

  it('returns false when cube is null', () => {
    const user = createUser();
    expect(isCubeEditable(null, user)).toBe(false);
  });

  it('returns false for a random user who is not a collaborator', () => {
    const owner = createUser({ id: 'owner-1' });
    const stranger = createUser({ id: 'stranger-1' });
    const cube = createCube({ owner, collaborators: [] });
    expect(isCubeEditable(cube, stranger)).toBe(false);
  });

  it('returns true for a user listed in collaborators', () => {
    const owner = createUser({ id: 'owner-1' });
    const collaborator = createUser({ id: 'collab-1' });
    const cube = createCube({ owner, collaborators: ['collab-1'] });
    expect(isCubeEditable(cube, collaborator)).toBe(true);
  });

  it('returns true for a collaborator even when multiple collaborators exist', () => {
    const owner = createUser({ id: 'owner-1' });
    const collaborator = createUser({ id: 'collab-2' });
    const cube = createCube({ owner, collaborators: ['collab-1', 'collab-2', 'collab-3'] });
    expect(isCubeEditable(cube, collaborator)).toBe(true);
  });

  it('returns false for a user whose id does not appear in collaborators', () => {
    const owner = createUser({ id: 'owner-1' });
    const stranger = createUser({ id: 'stranger-1' });
    const cube = createCube({ owner, collaborators: ['collab-1', 'collab-2'] });
    expect(isCubeEditable(cube, stranger)).toBe(false);
  });

  it('returns true for an admin regardless of ownership or collaborators', () => {
    const owner = createUser({ id: 'owner-1' });
    const admin = createUser({ id: 'admin-1' });
    const cube = createCube({ owner, collaborators: [] });
    (util.isAdmin as jest.Mock).mockReturnValue(true);
    expect(isCubeEditable(cube, admin)).toBe(true);
  });

  it('handles a cube with no collaborators field (legacy data)', () => {
    const owner = createUser({ id: 'owner-1' });
    const stranger = createUser({ id: 'stranger-1' });
    const cube = createCube({ owner });
    // Remove collaborators to simulate legacy data
    delete (cube as any).collaborators;
    expect(isCubeEditable(cube, stranger)).toBe(false);
  });
});
