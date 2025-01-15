declare module 'elo-rating' {
  interface EloRatingResult {
    playerRating: number;
    opponentRating: number;
  }

  interface EloRating {
    calculate(playerRating: number, opponentRating: number, playerWon: boolean): EloRatingResult;
  }

  const EloRating: EloRating;
  export default EloRating;
}
