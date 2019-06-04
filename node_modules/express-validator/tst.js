const expressValidator = require('./');
const { check, checkSchema, oneOf, validationResult } = require('./check');
const { matchedData } = require('./filter');
const express = require('express');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.text());
app.all('/*', [
  check('id').escape()
], (req, res) => {
  const data = matchedData(req, { onlyValidData: false });
  const result = validationResult(req);

  res.json({
    data,
    errors: result.array()
  });
});

// app.use(expressValidator());
// app.use((req, res) => {
//   req.checkBody('id').custom(value => {
//     return new Promise(resolve => {
//       setTimeout(() => {
//         resolve();
//       }, 3000);
//     });
//   });
//   req.checkBody({
//     id: {
//       notEmpty: { errorMessage: 'not empty' }
//     }
//   });

//   req.getValidationResult().then(result => {
//     res.json({
//       errors: result.mapped()
//     });
//   });
// });

app.listen(3001);