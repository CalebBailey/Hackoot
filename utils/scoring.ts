/**
 * Kahoot-style scoring algorithm
 * 
 * Formula: Points = Round((1 - ((responseTime / timerDuration) / 2)) * maxPoints)
 * 
 * - Max points: 1000 for a correct answer
 * - Faster answers get more points
 * - If answered in less than 0.5 seconds, award max points
 * - Timer is fixed at 20 seconds per question
 * 
 * Example: 2 second response on 20 second timer
 * = Round((1 - ((2/20) / 2)) * 1000)
 * = Round((1 - (0.1 / 2)) * 1000)
 * = Round((1 - 0.05) * 1000)
 * = Round(0.95 * 1000)
 * = 950 points
 */

export const QUESTION_TIME_LIMIT = 20; // Fixed 20 seconds like Kahoot
export const MAX_POINTS = 1000;

export function calculateKahootPoints(
  correct: boolean,
  responseTimeSeconds: number,
  timerDuration: number = QUESTION_TIME_LIMIT,
  doublePoints: boolean = false
): number {
  if (!correct) return 0;

  const multiplier = doublePoints ? 2 : 1;

  // If answered extremely fast (under 0.5s), award max points
  if (responseTimeSeconds < 0.5) {
    return MAX_POINTS * multiplier;
  }

  // Clamp response time to valid range
  const clampedTime = Math.max(0, Math.min(responseTimeSeconds, timerDuration));

  // Kahoot formula: Points = Round((1 - ((responseTime / timerDuration) / 2)) * maxPoints)
  const timeFactor = (clampedTime / timerDuration) / 2;
  const points = Math.round((1 - timeFactor) * MAX_POINTS);

  return Math.max(0, points) * multiplier;
}

/**
 * Calculate response time from question start to answer submission
 */
export function getResponseTime(questionStartedAt: number, submittedAt: number): number {
  return Math.max(0, (submittedAt - questionStartedAt) / 1000);
}
