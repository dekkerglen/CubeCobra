export class CubeOverviewPage {
  page: any;
  cubeDescription: any;
  listLink: any;
  cardCount: any;
  blogPostChangeLog: any;

  constructor(page: any) {
    this.page = page;

    this.listLink = page.getByRole('link', { name: 'List' });
    this.cardCount = page.getByText('1 Card Cube', { exact: true });
    this.blogPostChangeLog = page.getByText('Mainboard Changelist+0, -');
  }
  validateCubeDescription = async (text) => {
    this.cubeDescription = this.page.locator('div').filter({ hasText: text }).first();
    await this.cubeDescription.waitFor();
  };
  clickList = async () => {
    await this.listLink.waitFor();
    await this.listLink.click();
    await this.page.waitForURL(/\/list/);
  };
  validateChangeLog = async () => {
    await this.page.pause();
    await this.blogPostChangeLog.waitFor();
  };
}
