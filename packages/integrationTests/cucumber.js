This file has been deleted.
module.exports = {
  default: {
    requireModule: ['ts-node/register'],
    require: ['features/**/*.ts'],
    format: [
      'progress-bar',
      'html:reports/cucumber-report.html',
      'json:reports/cucumber-report.json',
    ],
    formatOptions: {
      snippetInterface: 'async-await'
    },
    parallel: 1,
    retry: 0,
    tags: 'not @skip',  // Skip tests tagged with @skip
  }
};
