import { Page } from 'playwright';

import { getYourCube } from './../playwrightUtils/getYourCube';

export class DashboardPage {
  page: Page;
  yourCube: any;

  constructor(page: Page) {
    this.page = page;
  }
  // Validates cube is displayed on the Dashboard Page
  async validateTestCubeDisplays(name: string, cards: string, followers: string) {
    this.yourCube = await getYourCube(this.page, name, cards, followers);
    await this.yourCube.waitFor();
  }
  // Clicks on a cube displayed on the Dashboard page
  async clickCubeFromYourCube(name: string, cards: string, followers: string) {
    this.yourCube = await getYourCube(this.page, name, cards, followers);
    await this.yourCube.waitFor();
    await this.yourCube.click();
  }
}
