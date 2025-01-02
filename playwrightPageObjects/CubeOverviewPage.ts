export class CubeOverviewPage {
  page: any;
  cubeDescription: any;
  listLink: any;
  cardCount: any;
  blogPostNuetralChangeLog: any;
  blogPostRemovedChangeLog: any;
  blogPostAddedChangeLog: any;

  constructor(page: any) {
    this.page = page;

    this.listLink = page.getByRole('link', { name: 'List' });
    this.cardCount = page.getByText('1 Card Cube', { exact: true });
    // Todo make these more dynamic as part of the add and remove card functions
    this.blogPostNuetralChangeLog = page.getByText('Mainboard Changelist+0, -');
    this.blogPostRemovedChangeLog = page.getByText('Mainboard Changelist+0, -1');
    this.blogPostAddedChangeLog = page.getByText('Mainboard Changelist+1, -');
  }
  // Validates cube description passed as an argmument displays on the overview page
  validateCubeDescription = async (text) => {
    this.cubeDescription = this.page.locator('div').filter({ hasText: text }).first();
    await this.cubeDescription.waitFor();
  };
  // Todo make these more dynamic as part of the add and remove card functions
  // Clicks List link from the Cube Overview page
  clickList = async () => {
    await this.listLink.waitFor();
    await this.listLink.click();
    await this.page.waitForURL(/\/list/);
  };
  // Validates changelog correctly displays after card is added then removed
  validateNuetralChangeLog = async () => {
    await this.blogPostNuetralChangeLog.waitFor();
  };
  // Validates changelog correctly displays after card is removed
  validateAddedChangeLog = async () => {
    await this.blogPostAddedChangeLog.waitFor();
  };
  // Validates changelog correctly displays after card is added
  validateRemovedChangeLog = async () => {
    await this.blogPostRemovedChangeLog.waitFor();
  };
}
