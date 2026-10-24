/**
 * Secrets that must be present in production. Each of these used to fall back to a
 * guessable default ('default-secret', an empty HMAC key), which turned a deploy that lost
 * an environment variable into forgeable sessions or webhooks. Fail at boot instead; the
 * immutable Elastic Beanstalk deploy rolls back when the new instances don't come up.
 */
export const missingRequiredSecrets = (env: NodeJS.ProcessEnv = process.env): string[] => {
  if (env.NODE_ENV !== 'production') {
    return [];
  }
  const required = ['SESSION'];
  if (env.ENABLE_BOT_SECURITY !== 'false') {
    required.push('CAPTCHA_SECRET_KEY');
  }
  return required.filter((name) => !env[name] || env[name]!.trim() === '');
};

export const assertRequiredSecrets = (env: NodeJS.ProcessEnv = process.env): void => {
  const missing = missingRequiredSecrets(env);
  if (missing.length > 0) {
    throw new Error(`Refusing to start: required secret(s) not set: ${missing.join(', ')}`);
  }
};
