import { randomInt } from "node:crypto";
import type { TestInfo } from "@playwright/test";

const FIRST_YEAR = 1800;
// More lanes than workers ever run at once; with eight eras they reach 1999
const LANES = 25;
const ERAS = 8;

/**
 * A year long gone that no other running test is using. The finance views add
 * up every transaction of a month, and the dashboard specs share one user: a
 * test that keeps its transactions in a year of its own can check exact totals.
 *
 * Tests that run at the same time are in different workers, and each worker has
 * its own lane of years. The era is random, so two runs that overlap rarely
 * land on the same year.
 */
export function ownYear(testInfo: TestInfo): number {
  return FIRST_YEAR + (testInfo.parallelIndex % LANES) + LANES * randomInt(ERAS);
}

/** True for the years `ownYear` hands out: the only ones a test may empty. */
export function isOwnYear(year: number): boolean {
  return Number.isInteger(year) && year >= FIRST_YEAR && year < FIRST_YEAR + LANES * ERAS;
}
