import { Page } from 'playwright'; // Import Page from Playwright

export async function getYourCube(page: Page, name: string, cards: string, followers: string) {
  return page.getByRole('link', { name: `${name} ${cards} Card Cube ${followers}` });
}
