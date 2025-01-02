import { Page } from 'playwright';

import { getYourCube } from './../playwrightUtils/getYourCube';

export class DashboardPage {
  page: Page;
  yourCube: any;

  constructor(page: Page) {
    this.page = page;
  }

  async validateTestCubeDisplays(name: string, cards: string, followers: string) {
    this.yourCube = await getYourCube(this.page, name, cards, followers);
    await this.yourCube.waitFor();
  }

  async clickCubeFromYourCube(name: string, cards: string, followers: string) {
    this.yourCube = await getYourCube(this.page, name, cards, followers);
    await this.yourCube.waitFor();
    await this.yourCube.click();
  }
}
