import { DraftAction, DraftFormat, DraftStep } from '../../../src/datatypes/Draft';
import { normalizeDraftFormatSteps, normalizeDraftSteps } from '../../../src/util/draftutil';

const createMockDraftFormat = (overrides?: Partial<DraftFormat>): DraftFormat => {
  return {
    title: 'Custom Draft',
    packs: [
      {
        slots: ['*'],
        steps: [
          { action: 'pick', amount: 1 },
          { action: 'pass', amount: null },
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
