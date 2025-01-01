export class DashboardPage {
  page: any;
  loginLink2: any;
  yourCubeTesting: any;

  constructor(page) {
    this.page = page;
  }
  validateTestCubeDisplays = async (name, cards, followers) => {
    this.yourCubeTesting = this.page.getByRole('link', { name: `${name} ${cards} Card Cube ${followers}` });
    await this.yourCubeTesting.waitFor();
  };
}
