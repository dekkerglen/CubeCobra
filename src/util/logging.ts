const FIELDS_TO_SANITIZE = ['password', 'password2'];

export const sanitizeHttpBody = (body?: Record<string, any>): Record<string, any> | undefined => {
  if (!body) {
    return body;
  }

  const sanitizedBody = { ...body };
  for (const field of FIELDS_TO_SANITIZE) {
    delete sanitizedBody[field];
  }
  return sanitizedBody;
};
