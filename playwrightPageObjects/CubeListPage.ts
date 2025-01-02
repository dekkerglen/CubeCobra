export class CubeListPage {
  page: any;
  cubeCard: any;
  removeFromCubeButton: any;
  changeLogRemove: any;
  saveChangeButton: any;
  editLink: any;
  cardToAddField: any;
  addButton: any;
  overviewLink: any;

  constructor(page: any) {
    this.page = page;

    this.removeFromCubeButton = page.getByRole('button', { name: 'Remove from cube' });
    this.changeLogRemove = page
      .locator('div')
      .filter({ hasText: /^Mainboard Changelist\+0, -1, 0 Total×Soldier of Fortune$/ })
      .first();
    this.saveChangeButton = page.getByRole('button', { name: 'Save Changes' });
    this.editLink = page.getByText('Edit').first();
    this.cardToAddField = page.getByPlaceholder('Card to Add');
    this.addButton = page.getByRole('button', { name: 'Add' });
    this.overviewLink = page.getByRole('link', { name: 'Overview' });
  }
  clickCard = async (clickCardText) => {
    this.cubeCard = this.page
      .locator('div')
      .filter({ hasText: new RegExp(`^${clickCardText}$`) })
      .first();
    await this.cubeCard.waitFor();
    await this.cubeCard.click();
  };
  removefromCube = async () => {
    await this.removeFromCubeButton.waitFor();
    await this.removeFromCubeButton.click();
    await this.saveChangeButton.waitFor();
    await this.saveChangeButton.click();
  };
  addToCube = async (cardName) => {
    await this.page.waitForTimeout(3000);
    await this.editLink.waitFor();
    await this.editLink.click();
    await this.cardToAddField.waitFor();
    await this.cardToAddField.fill(cardName);
    await this.addButton.waitFor();
    await this.addButton.click();
    await this.saveChangeButton.waitFor();
    await this.saveChangeButton.click();
  };
  clickOverview = async () => {
    await this.overviewLink.waitFor();
    await this.overviewLink.click();
    await this.page.waitForURL(/\/overview/);
  };
}
