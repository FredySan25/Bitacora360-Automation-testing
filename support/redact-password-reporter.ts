import type { Reporter, TestCase, TestResult, TestStep } from "@playwright/test/reporter";

/**
 * Keeps the test user's password out of the reports. Playwright titles a step
 * after the value it types (`Fill "<value>"`), and the HTML report of the CI
 * runs is published to GitHub Pages.
 */
export default class RedactPasswordReporter implements Reporter {
  private readonly password = process.env.E2E_USER_PASSWORD;

  onStepBegin(_test: TestCase, _result: TestResult, step: TestStep) {
    if (this.password) {
      step.title = step.title.replaceAll(this.password, "***");
    }
  }
}
