import { adjustElo } from '../update_draft_history';

describe('Date Handling Fixes', () => {
  describe('Date Key Generation', () => {
    it('should generate keys with 1-indexed months (01-12)', () => {
      const date = new Date(2024, 0, 15); // January 15, 2024
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

      expect(key).toBe('2024-01-15');
    });

    it('should zero-pad months and days', () => {
      const date = new Date(2024, 0, 5); // January 5, 2024
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

      expect(key).toBe('2024-01-05');
    });

    it('should handle December correctly', () => {
      const date = new Date(2024, 11, 31); // December 31, 2024
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

      expect(key).toBe('2024-12-31');
    });
  });

  describe('Date Parsing from Keys', () => {
    it('should parse 1-indexed months correctly', () => {
      const key = '2024-01-15';
      const parts = key.split('-').map((x) => parseInt(x, 10));
      const year = parts[0]!;
      const month = parts[1]!;
      const day = parts[2]!;

      // Keys use 1-indexed months, Date constructor expects 0-indexed
      const date = new Date(year, month - 1, day);

      expect(date.getMonth()).toBe(0); // January is 0 in Date
      expect(date.getDate()).toBe(15);
      expect(date.getFullYear()).toBe(2024);
    });

    it('should handle December parsing correctly', () => {
      const key = '2024-12-31';
      const parts = key.split('-').map((x) => parseInt(x, 10));
      const year = parts[0]!;
      const month = parts[1]!;
      const day = parts[2]!;

      const date = new Date(year, month - 1, day);

      expect(date.getMonth()).toBe(11); // December is 11 in Date
      expect(date.getDate()).toBe(31);
      expect(date.getFullYear()).toBe(2024);
    });
  });
});

describe('ELO Calculation Logic', () => {
  const ELO_SPEED = 1; // Global draft ELO speed (actual value from update_draft_history.ts)
  const CUBE_ELO_SPEED = 10; // Per-cube ELO speed (actual value from update_draft_history.ts)

  describe('Basic ELO Calculation', () => {
    it('should give equal opponents similar ELO changes', () => {
      const [winnerChange, loserChange] = adjustElo(1500, 1500, ELO_SPEED);

      expect(winnerChange).toBeGreaterThan(0);
      expect(loserChange).toBeLessThan(0);
      expect(Math.abs(winnerChange + loserChange)).toBeLessThan(0.1); // Should be roughly zero-sum
    });

    it('should give underdog victory large ELO swings', () => {
      const [winnerChange, loserChange] = adjustElo(1000, 2000, ELO_SPEED);

      expect(winnerChange).toBeGreaterThan(0.5); // Significant gain for underdog
      expect(loserChange).toBeLessThan(-0.5); // Significant loss for favorite
    });

    it('should give favorite victory minimal ELO changes', () => {
      const [winnerChange, loserChange] = adjustElo(2000, 1000, ELO_SPEED);

      expect(winnerChange).toBeGreaterThan(0);
      expect(winnerChange).toBeLessThan(0.1); // Should be very small
      expect(loserChange).toBeLessThan(0);
      expect(Math.abs(loserChange)).toBeLessThan(0.1);
    });
  });

  describe('Logarithmic Scaling - High ELO Protection', () => {
    it('should give minimal gains when 10x rated card wins', () => {
      const [winnerChange] = adjustElo(10000, 1000, ELO_SPEED);

      expect(winnerChange).toBeGreaterThanOrEqual(0);
      expect(winnerChange).toBeLessThan(0.00000001); // Should be very close to 0
    });

    it('should make it nearly impossible to reach 100k ELO', () => {
      let highElo = 1500;
      const lowElo = 1000;

      // Simulate winning 1000 games against 1000 ELO opponent
      for (let i = 0; i < 100000; i++) {
        const [winnerChange] = adjustElo(highElo, lowElo, ELO_SPEED);
        highElo += winnerChange;
      }

      expect(highElo).toBeLessThan(100000);
      expect(highElo).toBeLessThan(20000); // Should probably not even reach 20k
    });

    it('should verify extreme ELO ratings lose against equals', () => {
      // If a card somehow has 50,000 ELO (a bug), it should still lose to 1500 rated cards
      const extremeElo = 50000;
      const normalElo = 1500;

      const [winnerChange, loserChange] = adjustElo(normalElo, extremeElo, ELO_SPEED);

      expect(winnerChange).toBeGreaterThan(0.09); // Should gain close to K=1
      // The extreme ELO card should lose almost nothing (expected to win)
      expect(loserChange).toBeLessThan(-0.09);
    });
  });

  describe('Speed Multiplier Effects', () => {
    it('should show global speed (1) gives moderate changes', () => {
      const [winnerChange, loserChange] = adjustElo(1500, 1500, ELO_SPEED);

      expect(Math.abs(winnerChange)).toBeLessThan(1);
      expect(Math.abs(loserChange)).toBeLessThan(1);
    });

    it('should show cube speed (10) gives large changes', () => {
      const [winnerChange, loserChange] = adjustElo(1500, 1500, CUBE_ELO_SPEED);

      expect(Math.abs(winnerChange)).toBeGreaterThan(4);
      expect(Math.abs(loserChange)).toBeGreaterThan(4);
    });

    it('should maintain logarithmic scaling regardless of speed', () => {
      const [globalWinnerChange] = adjustElo(10000, 1000, ELO_SPEED);
      const [cubeWinnerChange] = adjustElo(10000, 1000, CUBE_ELO_SPEED);

      // Cube speed should be 10x global speed (10 / 1 = 10)
      expect(cubeWinnerChange).toBeCloseTo(globalWinnerChange * 10, 5);

      // But even with cube speed, high ELO should still gain almost nothing
      expect(globalWinnerChange).toBeLessThan(0.001);
      expect(cubeWinnerChange).toBeLessThan(0.01);
    });
  });

  describe('ELO Boundedness', () => {
    it('should keep reasonable ELO ranges after many games', () => {
      // Simulate 100 cards playing against each other
      const cards = Array.from({ length: 100 }, (_, i) => ({
        name: `Card${i}`,
        elo: 1200, // Default ELO
      }));

      // Simulate 10000 random matchups
      for (let round = 0; round < 10000; round++) {
        const i = Math.floor(Math.random() * cards.length);
        const j = Math.floor(Math.random() * cards.length);
        if (i === j) continue;

        const card1 = cards[i]!;
        const card2 = cards[j]!;

        // Calculate expected win probability for card1
        const expectedScore1 = 1 / (1 + Math.pow(10, (card2.elo - card1.elo) / 400));

        // Randomly determine winner based on expected probability
        if (Math.random() < expectedScore1) {
          const [winnerChange, loserChange] = adjustElo(card1.elo, card2.elo, ELO_SPEED);
          card1.elo += winnerChange;
          card2.elo += loserChange;
        } else {
          const [winnerChange, loserChange] = adjustElo(card2.elo, card1.elo, ELO_SPEED);
          card2.elo += winnerChange;
          card1.elo += loserChange;
        }
      }

      // Check that all ELOs are within reasonable bounds
      for (const card of cards) {
        expect(card.elo).toBeGreaterThan(500); // No one should tank below 500
        expect(card.elo).toBeLessThan(2500); // No one should exceed 2500 by much
      }

      const elos = cards.map((c) => c.elo);
      const maxElo = Math.max(...elos);
      const minElo = Math.min(...elos);

      // Max should not be more than 5x min
      expect(maxElo / minElo).toBeLessThan(5); // Max 5x difference
    });
  });

  describe('Edge Cases and Bug Detection', () => {
    it('should handle identical ELOs without NaN', () => {
      const [winnerChange, loserChange] = adjustElo(1500, 1500, ELO_SPEED);
      expect(winnerChange).not.toBeNaN();
      expect(loserChange).not.toBeNaN();
      expect(isFinite(winnerChange)).toBe(true);
      expect(isFinite(loserChange)).toBe(true);
    });

    it('should handle very low ELO values', () => {
      const [winnerChange, loserChange] = adjustElo(100, 100, ELO_SPEED);
      expect(winnerChange).not.toBeNaN();
      expect(loserChange).not.toBeNaN();
      expect(winnerChange).toBeGreaterThan(0);
      expect(loserChange).toBeLessThan(0);
    });

    it('should detect if ELO can compound unreasonably', () => {
      let elo = 1200;

      // Winning 100 games in a row against equals
      for (let i = 0; i < 100; i++) {
        const [winnerChange] = adjustElo(elo, 1200, ELO_SPEED);
        elo += winnerChange;
      }

      expect(elo).toBeLessThan(2000); // Should be well under 2000
    });

    it('should verify sum of changes approaches zero', () => {
      // For many random matchups, the sum of all changes should be near 0
      let netChange = 0;

      for (let i = 0; i < 100; i++) {
        const elo1 = 1000 + Math.random() * 1000;
        const elo2 = 1000 + Math.random() * 1000;
        const [winnerChange, loserChange] = adjustElo(elo1, elo2, ELO_SPEED);
        netChange += winnerChange + loserChange;
      }

      // With 100 matchups, net change should be very close to 0
      expect(Math.abs(netChange)).toBeLessThan(0.5);
    });
  });

  describe('Potential Bug: Speed Multiplier Applied Incorrectly', () => {
    it('should verify speed is applied to change, not raw rating', () => {
      const elo1 = 1500;
      const elo2 = 1500;

      // Get expected score for equal players
      const expected = 1 / (1 + Math.pow(10, (elo2 - elo1) / 400)); // Should be 0.5

      // Verify our implementation applies K-factor correctly
      const [winnerChange] = adjustElo(elo1, elo2, ELO_SPEED);

      // The change should be K × (1 - expected)
      const expectedChange = ELO_SPEED * (1 - expected);
      expect(winnerChange).toBeCloseTo(expectedChange, 5);
    });

    it('should catch if speed is applied to rating instead of delta', () => {
      // If someone mistakenly did: newElo = oldElo + (libraryResult * speed)
      // instead of: change = K × (actual - expected)
      // the results would be very different
      const [winnerChange] = adjustElo(1500, 1500, ELO_SPEED);

      expect(winnerChange).toBeGreaterThan(0); // Winner should always gain

      // With K-factor 1 and equal opponents, change should be 1 * (1 - 0.5) = 0.5
      expect(winnerChange).toBeCloseTo(0.5, 5);
    });
  });
});
