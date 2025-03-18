import { DraftAction, DraftFormat, DraftStep } from '../../../src/datatypes/Draft';
import { getErrorsInFormat, normalizeDraftFormatSteps, normalizeDraftSteps } from '../../../src/util/draftutil';

const createMockDraftFormat = (overrides?: Partial<DraftFormat>): DraftFormat => {
  return {
    title: 'Custom Draft',
    packs: [
      {
        slots: ['*', '*'],
        steps: [
          { action: 'pick', amount: 1 },
          { action: 'pass', amount: null },
          { action: 'pick', amount: 1 },
        ],
      },
      {
        slots: ['*', '*'],
        steps: [
          { action: 'pick', amount: 1 },
          { action: 'pass', amount: null },
          { action: 'pick', amount: 1 },
        ],
      },
    ],
    multiples: false,
    markdown: 'Text',
    html: 'Text',
    defaultSeats: 4,
    ...overrides,
  };
};

describe('normalizeDraftSteps', () => {
  it('Removes the last step if it is pass, as that is invalid', () => {
    const steps: DraftStep[] = [
      { action: 'pick', amount: 1 },
      { action: 'pass', amount: null },
      { action: 'pick', amount: 1 },
      { action: 'pass', amount: null },
    ];

    const normalizedSteps = normalizeDraftSteps(steps);
    expect(normalizedSteps.length).toEqual(3);
    expect(normalizedSteps).toEqual([
      { action: 'pick', amount: 1 },
      { action: 'pass', amount: null },
      { action: 'pick', amount: 1 },
    ]);
  });

  //endpack is not an action users can choose, the backend automatically adds to the end of each pack
  const validLastActions: DraftAction[] = ['pick', 'pickrandom', 'trash', 'trashrandom', 'endpack'];

  it.each(validLastActions)('No changes for a %s last step', (lastAction) => {
    const steps: DraftStep[] = [
      { action: 'pick', amount: 1 },
      { action: 'pass', amount: null },
      { action: 'pick', amount: 1 },
      { action: lastAction, amount: null },
    ];

    const normalizedSteps = normalizeDraftSteps(steps);
    expect(normalizedSteps.length).toEqual(4);
    expect(normalizedSteps).toEqual([
      { action: 'pick', amount: 1 },
      { action: 'pass', amount: null },
      { action: 'pick', amount: 1 },
      { action: lastAction, amount: null },
    ]);
  });
});

describe('normalizeDraftFormatSteps', () => {
  it('Does nothing when steps are null', () => {
    const format = createMockDraftFormat({
      packs: [
        {
          slots: ['*', '*'],
          steps: null,
        },
        {
          slots: ['*'],
          steps: null,
        },
      ],
    });

    const normalizedFormat = normalizeDraftFormatSteps(format);
    expect(normalizedFormat).toEqual(format);
  });

  it('Normalizes steps that end in pass', () => {
    const format = createMockDraftFormat({
      packs: [
        {
          slots: ['*'],
          steps: [
            { action: 'pick', amount: 1 },
            { action: 'pass', amount: null },
          ],
        },
        {
          slots: ['*', '*'],
          steps: [
            { action: 'pick', amount: 1 },
            { action: 'pass', amount: null },
            { action: 'pick', amount: 2 },
          ],
        },
        {
          slots: ['*'],
          steps: [
            { action: 'pick', amount: 1 },
            { action: 'pass', amount: null },
          ],
        },
      ],
    });

    const normalizedFormat = normalizeDraftFormatSteps(format);
    expect(normalizedFormat.packs[0].steps).toEqual([{ action: 'pick', amount: 1 }]);
    expect(normalizedFormat.packs[1].steps).toEqual([
      { action: 'pick', amount: 1 },
      { action: 'pass', amount: null },
      { action: 'pick', amount: 2 },
    ]);
    expect(normalizedFormat.packs[2].steps).toEqual([{ action: 'pick', amount: 1 }]);
  });
});

describe('getErrorsInFormat', () => {
  it('returns null when format is valid', () => {
    const format = createMockDraftFormat();
    const result = getErrorsInFormat(format);
    expect(result).toBeNull();
  });

  it('returns error when format is undefined', () => {
    const result = getErrorsInFormat(undefined as unknown as DraftFormat);
    expect(result).toContain('Internal error in the format.');
  });

  it('returns error when packs is undefined', () => {
    const format = createMockDraftFormat();
    delete (format as any).packs;
    const result = getErrorsInFormat(format);
    expect(result).toContain('Internal error in the format.');
  });

  it('returns error when title is empty', () => {
    const format = createMockDraftFormat({ title: '   ' });
    const result = getErrorsInFormat(format);
    expect(result).toContain('title must not be empty.');
  });

  it('returns error when format has no packs', () => {
    const format = createMockDraftFormat({ packs: [] });
    const result = getErrorsInFormat(format);
    expect(result).toContain('Format must have at least 1 pack.');
  });

  it('returns error when defaultSeats is not a number', () => {
    const format = createMockDraftFormat({ defaultSeats: 'invalid' as any });
    const result = getErrorsInFormat(format);
    expect(result).toContain('Default seat count must be a number.');
  });

  it.each([1, 17])('returns error when defaultSeats is out of range: %i', (seats) => {
    const format = createMockDraftFormat({ defaultSeats: seats });
    const result = getErrorsInFormat(format);
    expect(result).toContain('Default seat count must be between 2 and 16.');
  });

  it('accepts format when pack has null steps', () => {
    const format = createMockDraftFormat({
      packs: [
        {
          slots: ['*'],
          steps: null,
        },
      ],
    });
    const result = getErrorsInFormat(format);
    expect(result).toBeNull();
  });

  it('returns error when pack steps count does not match slots count', () => {
    const format = createMockDraftFormat({
      packs: [
        {
          slots: ['*', '*', '*'],
          steps: [
            { action: 'pick', amount: 1 },
            { action: 'pass', amount: null },
            { action: 'pick', amount: 1 },
          ],
        },
      ],
    });
    const result = getErrorsInFormat(format);
    expect(result).toContain('Pack 1 has 3 slots but has steps to pick or trash 2 cards.');
  });

  it('returns error when pack steps end in pass', () => {
    const format = createMockDraftFormat({
      packs: [
        {
          slots: ['*'],
          steps: [
            { action: 'pick', amount: 1 },
            { action: 'pass', amount: null },
          ],
        },
      ],
    });
    const result = getErrorsInFormat(format);
    expect(result).toContain('Pack 1 cannot end with a pass action.');
  });

  it('handles multiple errors', () => {
    const format = createMockDraftFormat({
      title: '',
      defaultSeats: 1,
      packs: [
        {
          slots: ['*', '*'],
          steps: [{ action: 'pick', amount: 1 }],
        },
      ],
    });
    const result = getErrorsInFormat(format);
    expect(result).toContain('title must not be empty.');
    expect(result).toContain('Default seat count must be between 2 and 16.');
    expect(result).toContain('Pack 1 has 2 slots but has steps to pick or trash 1 cards.');
    expect(result?.length).toBe(3);
  });
});
