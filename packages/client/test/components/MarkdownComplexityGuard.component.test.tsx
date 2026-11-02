import React from 'react';

import { render } from '@testing-library/react';

import '@testing-library/jest-dom';

jest.mock('react-syntax-highlighter', () => ({ __esModule: true, default: () => null }));
jest.mock('react-syntax-highlighter/dist/cjs/styles/hljs', () => ({ a11yDark: {}, a11yLight: {} }));

import Markdown, { cardrowScanWork, MAX_CARDROW_WORK } from 'components/Markdown';

const textOf = (markdown: string) => render(<Markdown markdown={markdown} />).container.textContent ?? '';

describe('cardrow scan-work metric', () => {
  it.each([
    ["'<<' x15000", '<<'.repeat(15000), 449955001],
    ["'<<' x15000 + '>>'", '<<'.repeat(15000) + '>>', 449955001],
    ["'>>' + '<<' x15000", '>>' + '<<'.repeat(15000), 449955001],
    ["'<<x>>' x6000 (legitimate)", '<<x>>'.repeat(6000), 6000],
    ["'<a' x16000 (no << at all)", '<a'.repeat(16000), 0],
    ['empty', '', 0],
    ['whitespace only', '   \n\n  ', 0],
    ['lone < at end of line', 'a <\nb <', 0],
    ['short closed row then a trailing lone <', 'a <<b>> <\nnext <', 1],
  ])('scores %s', (_label, input, expected) => {
    expect(cardrowScanWork(input)).toBe(expected);
  });

  it('ignores << inside a fenced code block', () => {
    const cpp = 'std::cout << x << y;'.repeat(2000);
    expect(cardrowScanWork('```cpp\n' + cpp + '\n```\n')).toBe(0);
    // The same text unfenced is genuinely quadratic for the tokenizer, so it must still score high.
    expect(cardrowScanWork(cpp)).toBe(79982000);
  });

  it('leaves a wide margin between legitimate content and the threshold', () => {
    expect(cardrowScanWork('<<x>>'.repeat(6000))).toBeLessThan(MAX_CARDROW_WORK / 100);
    expect(cardrowScanWork('<<'.repeat(15000))).toBeGreaterThan(MAX_CARDROW_WORK * 50);
  });

  /* A lone `>` does not end a cardrow scan: the closing construct needs `>>`, and on failure
   * `consumeGt` swallows the `>` and keeps scanning to end of line. So interleaving single `>`
   * characters must not collapse the score — the tokenizer still walks the whole line.
   */
  it.each([
    ["'<<a>' x7500 (30k, single > after each start)", '<<a>'.repeat(7500)],
    ["'<<<a>' x6000 (two starts per group)", '<<<a>'.repeat(6000)],
  ])('scores %s above the threshold', (_label, input) => {
    expect(cardrowScanWork(input)).toBeGreaterThan(MAX_CARDROW_WORK);
  });
});

describe('the cardrow complexity guard', () => {
  it('renders card rows normally for a legitimate document', () => {
    expect(textOf('<<[[!Hexdrinker]][[!Lotus Cobra]]>>\n')).not.toContain('<<');
  });

  it('drops cardrow for a document that would blow up, leaving markers literal', () => {
    expect(textOf('<<'.repeat(15000))).toContain('<<');
  });

  it('keeps centering working when only the cardrow guard trips', () => {
    const container = render(<Markdown markdown={'>>> centered <<<\n\n' + '<<'.repeat(15000)} />).container;
    expect(container.querySelector('.text-center')).toHaveTextContent('centered');
  });

  it('still drops both extensions when centering also trips', () => {
    const container = render(<Markdown markdown={'>>>\n'.repeat(30) + '\n' + '<<'.repeat(15000)} />).container;
    expect(container.querySelector('.text-center')).not.toBeInTheDocument();
  });

  /* Coarse regression guard, not a performance target. Unguarded, these documents took 5,500-12,400ms;
   * guarded they take roughly a second, most of which is React rendering 30,000 characters into jsdom
   * rather than tokenizing. The bound is deliberately loose because wall-clock under a loaded machine is
   * noisy - a 1,000ms bound flaked at 1,036ms when the full suite ran alongside a dev server. The
   * deterministic signal that the guard engaged is the literal `<<` assertion, not the clock.
   */
  const GUARDED_RENDER_BUDGET_MS = 5000;

  it('renders a pathological document fast', () => {
    const start = Date.now();
    textOf('<<'.repeat(15000));
    expect(Date.now() - start).toBeLessThan(GUARDED_RENDER_BUDGET_MS);
  });

  it.each([
    ["'<<a>' x7500", '<<a>'.repeat(7500)],
    ["'<<<a>' x6000", '<<<a>'.repeat(6000)],
  ])('drops cardrow for %s, where lone > characters hide the cost', (_label, input) => {
    const start = Date.now();
    expect(textOf(input)).toContain('<<');
    expect(Date.now() - start).toBeLessThan(GUARDED_RENDER_BUDGET_MS);
  });
});
