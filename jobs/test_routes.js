const fs = require('fs');
const fetch = require('node-fetch');

const routes = JSON.parse(fs.readFileSync('private/routes.json'));
console.log(routes);

const done = false;

const handleResponse = (res) => {
  console.log(`   ${res.status}`);
};

const badRoute = '/cube/overview/communitycube';

(async () => {
  for (let i = 0; i < 10; i++) {
    console.log(`Iteration ${i + 1}`);
    for (const route of routes) {
      console.log(`   Fetching ${route}`);
      const res = await fetch(`http://localhost:5000${route}`);
      handleResponse(res);
    }
  }
  const route = badRoute;
  console.log(`   Fetching ${route}`);
  const res = await fetch(`http://localhost:5000${route}`);
  handleResponse(res);
})();
