import { Page, TestInfo } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Dump the current DOM to a file in the logs directory.
 * Call this in afterEach when a test fails to aid debugging.
 * Uses process.cwd() which is the integrationTests package root when running via npx playwright.
 */
export async function dumpDomOnFailure(page: Page, testInfo: TestInfo): Promise<void> {
  if (testInfo.status === 'passed') return;

  const sanitizedTitle = testInfo.title.replace(/[^a-zA-Z0-9]/g, '_');
  const logsDir = path.join(process.cwd(), 'logs');
  const domPath = path.join(logsDir, `dom_${sanitizedTitle}.html`);
  fs.mkdirSync(logsDir, { recursive: true });

  try {
    const html = await page.content();
    fs.writeFileSync(domPath, html);
    console.log(`DOM dumped to ${domPath}`);
  } catch (e) {
    console.log(`Failed to dump DOM: ${e}`);
  }
}
