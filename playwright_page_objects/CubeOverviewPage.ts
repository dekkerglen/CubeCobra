export class CubeOverviewPage {
  page: any;
  cubeDescription: any;

  constructor(page: any) {
    this.page = page;
  }
  validateCubeDescription = async (text) => {
    this.cubeDescription = this.page.locator('div').filter({ hasText: text }).first();
    await this.cubeDescription.waitFor();
  };
}
