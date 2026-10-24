import { csrfProtection, flashValidationErrors } from 'router/middleware';

import { passwordValidators, postHandler, resetLimiter } from './passwordreset';

// The reset form posts here; the handler itself lives in ./passwordreset alongside the GET
// that issues the page, so the two entry points can't drift apart.
export const routes = [
  {
    path: '/',
    method: 'post',
    handler: [resetLimiter, csrfProtection, ...passwordValidators, flashValidationErrors, postHandler],
  },
];
