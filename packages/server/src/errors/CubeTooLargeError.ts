/**
 * Thrown when a cube has more cards than can be rendered (CubeDynamoDao.getCards).
 *
 * This is a terminal condition for every card-loading route — no page can display the
 * cube — so it must be handled by rendering an explanatory page, NOT by redirecting to
 * another cube route (which would bounce list <-> about into a redirect storm). It is a
 * distinct type so handleRouteError can recognize it without string-matching messages.
 */
export class CubeTooLargeError extends Error {
  public readonly cubeId: string;
  public readonly cardCount: number;
  public readonly limit: number;

  constructor(cubeId: string, cardCount: number, limit: number) {
    super(`Cannot load cube: ${cubeId} - too many cards: ${cardCount}`);
    this.name = 'CubeTooLargeError';
    this.cubeId = cubeId;
    this.cardCount = cardCount;
    this.limit = limit;
    // Restore the prototype chain so `instanceof` works after TypeScript downlevels.
    Object.setPrototypeOf(this, CubeTooLargeError.prototype);
  }
}
