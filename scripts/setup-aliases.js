const moduleAlias = require('module-alias');
const path = require('path');

const isProduction = process.env.NODE_ENV === 'production';

if (isProduction) {
  moduleAlias.addAliases({
    analytics: path.join(__dirname, '../build/client/analytics'),
    components: path.join(__dirname, '../build/client/components'),
    contexts: path.join(__dirname, '../build/client/contexts'),
    datatypes: path.join(__dirname, '../build/datatypes'),
    drafting: path.join(__dirname, '../build/client/drafting'),
    filtering: path.join(__dirname, '../build/client/filtering'),
    generated: path.join(__dirname, '../build/client/generated'),
    hooks: path.join(__dirname, '../build/client/hooks'),
    layouts: path.join(__dirname, '../build/client/layouts'),
    markdown: path.join(__dirname, '../build/client/markdown'),
    pages: path.join(__dirname, '../build/client/pages'),
    res: path.join(__dirname, '../build/client/res'),
    utils: path.join(__dirname, '../build/client/utils'),
    src: path.join(__dirname, '../build'),
  });
} else {
  moduleAlias.addAliases({
    analytics: path.join(__dirname, '../src/client/analytics'),
    components: path.join(__dirname, '../src/client/components'),
    contexts: path.join(__dirname, '../src/client/contexts'),
    datatypes: path.join(__dirname, '../src/datatypes'),
    drafting: path.join(__dirname, '../src/client/drafting'),
    filtering: path.join(__dirname, '../src/client/filtering'),
    generated: path.join(__dirname, '../src/client/generated'),
    hooks: path.join(__dirname, '../src/client/hooks'),
    layouts: path.join(__dirname, '../src/client/layouts'),
    markdown: path.join(__dirname, '../src/client/markdown'),
    pages: path.join(__dirname, '../src/client/pages'),
    res: path.join(__dirname, '../src/client/res'),
    utils: path.join(__dirname, '../src/client/utils'),
    src: path.join(__dirname, '../src'),
  });
}
