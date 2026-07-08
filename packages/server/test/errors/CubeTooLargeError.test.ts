import { CubeTooLargeError } from '../../src/errors/CubeTooLargeError';

describe('CubeTooLargeError', () => {
  it('is an instance of both Error and CubeTooLargeError', () => {
    const err = new CubeTooLargeError('cube1', 55440, 20000);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(CubeTooLargeError);
    expect(err.name).toBe('CubeTooLargeError');
  });

  it('carries the cube id, card count, and limit for the message and error page', () => {
    const err = new CubeTooLargeError('cube1', 55440, 20000);
    expect(err.cubeId).toBe('cube1');
    expect(err.cardCount).toBe(55440);
    expect(err.limit).toBe(20000);
    expect(err.message).toContain('55440');
  });

  it('survives the getCards catch re-throw with its type intact', () => {
    // Mirrors the DAO pattern: a generic catch re-throws CubeTooLargeError as-is so
    // handleRouteError can still recognize it via instanceof.
    const reload = () => {
      try {
        throw new CubeTooLargeError('c', 30000, 20000);
      } catch (e) {
        if (e instanceof CubeTooLargeError) {
          throw e;
        }
        throw new Error(`Failed to load cards for cube: c - ${(e as Error).message}`);
      }
    };
    expect(reload).toThrow(CubeTooLargeError);
  });
});
