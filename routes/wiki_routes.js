const express = require('express');

const fs = require('fs');
const { render } = require('../serverjs/render');

const router = express.Router();

// Handles the 'wiki/' route with no path after the slash
// Redirects to the wiki home page
router.get('/', async (req, res) => {
  res.redirect('/wiki/home');
});

// Handle 'wiki/topic/subtopic/...' routes
// Match subdirectories of wiki whose names contain A-Z, a-z, _, and forward slashes only
// Importantly, exclude '..'
// Does match something like '//////', but that gets canonicalized to just '/'
// Possible security issues here, since this displays the contents of files
router.get('/:page([A-Za-z/_]+)', async (req, res) => {
  const { page } = req.params;
  let fileContents = 'Unable to read wiki page';
  try {
    const fd = fs.openSync(`wiki/${page}.md`, 'r');
    fileContents = fs.readFileSync(fd, { encoding: 'utf-8', flag: 'r' });
  } catch (error) {
    return render(req, res, 'WikiPage', { markdown: `# Error loading wiki page wiki/${page}.md: ${error}` });
  }
  return render(req, res, 'WikiPage', { markdown: `${fileContents}` });
});

module.exports = router;
