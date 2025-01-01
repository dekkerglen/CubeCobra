export class SearchPage {
  page: any;
  cardSearchField: any;
  searchButton: any;
  searchResult: any;

  constructor(page) {
    this.page = page;

    this.cardSearchField = page.getByPlaceholder('name:"Ambush Viper"');
    this.searchButton = page.getByRole('button', { name: 'Search' });
  }
  // input only card name for argument
  searchCard = async (card: string) => {
    this.searchResult = this.page.getByRole('link', { name: card });
    await this.cardSearchField.waitFor();
    await this.cardSearchField.fill(`name:${card}`);
    await this.searchButton.waitFor();
    await this.searchButton.click();
    await this.searchResult.waitFor();
    await this.page.pause();
  };
}
