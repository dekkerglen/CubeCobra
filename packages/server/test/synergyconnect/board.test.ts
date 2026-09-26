import { SynergyConnectPuzzle, SynergyConnectSubmission } from '@utils/datatypes/SynergyConnect';
import { evaluateGuess, isComplete, toBoard } from 'serverutils/synergyconnect/board';

const card = (name: string) => ({ name, oracleId: `oracle-${name}` });

const createPuzzle = (overrides?: Partial<SynergyConnectPuzzle>): SynergyConnectPuzzle => ({
  id: '2026-09-26',
  type: 'HISTORY',
  date: '2026-09-26',
  theme: { filterText: 'keyword:Flying', description: 'with Flying' },
  groups: [
    { commander: card('Commander A'), cards: [card('a1'), card('a2'), card('a3'), card('a4')] },
    { commander: card('Commander B'), cards: [card('b1'), card('b2'), card('b3'), card('b4')] },
    { commander: card('Commander C'), cards: [card('c1'), card('c2'), card('c3'), card('c4')] },
    { commander: card('Commander D'), cards: [card('d1'), card('d2'), card('d3'), card('d4')] },
  ],
  // Reversed board order, so tests also prove order is honoured.
  order: Array.from({ length: 16 }, (_, i) => 15 - i),
  isActive: true,
  dateCreated: 0,
  dateLastUpdated: 0,
  ...overrides,
});

const createSubmission = (overrides?: Partial<SynergyConnectSubmission>): SynergyConnectSubmission => ({
  userId: 'user-1',
  date: '2026-09-26',
  solvedGroups: [],
  guesses: [],
  mistakes: 0,
  dateCreated: 0,
  dateLastUpdated: 0,
  ...overrides,
});

describe('toBoard', () => {
  it('never exposes commanders or group membership for unsolved groups', () => {
    const puzzle = createPuzzle();
    const board = toBoard(puzzle, null);
    const serialized = JSON.stringify(board);

    for (const group of puzzle.groups) {
      expect(serialized).not.toContain(group.commander.name);
      expect(serialized).not.toContain(group.commander.oracleId);
    }
    expect(board.cards).toHaveLength(16);
    expect(board.solvedGroups).toEqual([]);
  });

  it('returns cards in board order', () => {
    const board = toBoard(createPuzzle(), null);
    // order is reversed, so the first board card is the last group's last card.
    expect(board.cards[0]!.name).toEqual('d4');
    expect(board.cards[15]!.name).toEqual('a1');
  });

  it('keeps every card on the board and reveals solved groups in full', () => {
    const puzzle = createPuzzle();
    const board = toBoard(puzzle, createSubmission({ solvedGroups: [1] }));

    // Solved cards stay on the board — the client pins them to the top rows
    // rather than removing them, so they remain visible.
    expect(board.cards).toHaveLength(16);
    expect(board.cards.map((c) => c.name)).toContain('b1');
    expect(board.solvedGroups).toHaveLength(1);
    expect(board.solvedGroups[0]!.commander.name).toEqual('Commander B');
  });

  it('still hides commanders of groups that are not solved', () => {
    const puzzle = createPuzzle();
    const board = toBoard(puzzle, createSubmission({ solvedGroups: [1] }));
    const serialized = JSON.stringify(board);

    expect(serialized).toContain('Commander B');
    for (const name of ['Commander A', 'Commander C', 'Commander D']) {
      expect(serialized).not.toContain(name);
    }
  });
});

describe('evaluateGuess', () => {
  const puzzle = createPuzzle();

  it('resolves a correct group', () => {
    const result = evaluateGuess(puzzle, ['oracle-c1', 'oracle-c2', 'oracle-c3', 'oracle-c4']);
    expect(result).toEqual({ groupIndex: 2, guessGroups: [2, 2, 2, 2], oneAway: false });
  });

  it('flags a three-of-four guess as one away', () => {
    const result = evaluateGuess(puzzle, ['oracle-a1', 'oracle-a2', 'oracle-a3', 'oracle-b1']);
    expect(result?.groupIndex).toBeNull();
    expect(result?.oneAway).toBe(true);
    expect(result?.guessGroups).toEqual([0, 0, 0, 1]);
  });

  it('does not flag a two-two split as one away', () => {
    const result = evaluateGuess(puzzle, ['oracle-a1', 'oracle-a2', 'oracle-b1', 'oracle-b2']);
    expect(result?.groupIndex).toBeNull();
    expect(result?.oneAway).toBe(false);
  });

  it('rejects guesses that are not four distinct cards on the board', () => {
    expect(evaluateGuess(puzzle, ['oracle-a1', 'oracle-a2', 'oracle-a3'])).toBeNull();
    expect(evaluateGuess(puzzle, ['oracle-a1', 'oracle-a1', 'oracle-a2', 'oracle-a3'])).toBeNull();
    expect(evaluateGuess(puzzle, ['oracle-a1', 'oracle-a2', 'oracle-a3', 'not-a-card'])).toBeNull();
    // A commander is not a board card.
    expect(evaluateGuess(puzzle, ['oracle-a1', 'oracle-a2', 'oracle-a3', 'oracle-Commander A'])).toBeNull();
  });
});

describe('isComplete', () => {
  it('is true only once all four groups are solved', () => {
    expect(isComplete(createSubmission({ solvedGroups: [0, 1, 2] }))).toBe(false);
    expect(isComplete(createSubmission({ solvedGroups: [0, 1, 2, 3] }))).toBe(true);
  });
});
