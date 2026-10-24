import { GetParametersCommand } from '@aws-sdk/client-ssm';
import { loadSecretsFromSsm, loadSecretsOnce, parseSecretNames } from '@utils/ssmSecrets';

// A stand-in SSM client holding the given parameters; records each GetParameters call.
const fakeClient = (parameters: Record<string, string>) => {
  const calls: string[][] = [];
  return {
    calls,
    send: jest.fn(async (command: GetParametersCommand) => {
      const names = command.input.Names ?? [];
      calls.push(names);
      expect(command.input.WithDecryption).toBe(true);
      return {
        Parameters: names.filter((name) => name in parameters).map((name) => ({ Name: name, Value: parameters[name] })),
        InvalidParameters: names.filter((name) => !(name in parameters)),
      };
    }),
  };
};

describe('parseSecretNames', () => {
  it('reads required and optional (?) names', () => {
    expect(parseSecretNames(' SESSION, SESSION_PREVIOUS? ,,GA_API_SECRET?')).toEqual([
      { name: 'SESSION', optional: false },
      { name: 'SESSION_PREVIOUS', optional: true },
      { name: 'GA_API_SECRET', optional: true },
    ]);
    expect(parseSecretNames(undefined)).toEqual([]);
  });
});

describe('loadSecretsFromSsm', () => {
  it('does nothing without a prefix (local development)', async () => {
    const client = fakeClient({});
    const env: NodeJS.ProcessEnv = { SSM_SECRET_NAMES: 'SESSION' };
    await expect(loadSecretsFromSsm({ env, client: client as any })).resolves.toEqual({ loaded: [], skipped: [] });
    expect(client.send).not.toHaveBeenCalled();
  });

  it('copies each parameter into the environment under its own name', async () => {
    const client = fakeClient({
      '/cubecobra/prod/secrets/SESSION': 'session-value',
      '/cubecobra/prod/secrets/PATREON_HOOK_SECRET': 'hook-value',
    });
    const env: NodeJS.ProcessEnv = {
      SSM_SECRETS_PREFIX: '/cubecobra/prod/secrets',
      SSM_SECRET_NAMES: 'SESSION,PATREON_HOOK_SECRET,SESSION_PREVIOUS?',
      SESSION: 'stale',
    };

    const result = await loadSecretsFromSsm({ env, client: client as any });

    expect(result).toEqual({ loaded: ['SESSION', 'PATREON_HOOK_SECRET'], skipped: ['SESSION_PREVIOUS'] });
    expect(env.SESSION).toBe('session-value');
    expect(env.PATREON_HOOK_SECRET).toBe('hook-value');
    expect(env.SESSION_PREVIOUS).toBeUndefined();
  });

  it('fails when a required secret is missing', async () => {
    const client = fakeClient({ '/p/SESSION': 'x' });
    const env: NodeJS.ProcessEnv = { SSM_SECRETS_PREFIX: '/p/', SSM_SECRET_NAMES: 'SESSION,CAPTCHA_SECRET_KEY' };
    await expect(loadSecretsFromSsm({ env, client: client as any })).rejects.toThrow(/CAPTCHA_SECRET_KEY/);
  });

  it('requests at most 10 names per call', async () => {
    const names = Array.from({ length: 23 }, (_, i) => `SECRET_${i}`);
    const client = fakeClient(Object.fromEntries(names.map((name) => [`/p/${name}`, name.toLowerCase()])));
    const env: NodeJS.ProcessEnv = { SSM_SECRETS_PREFIX: '/p/', SSM_SECRET_NAMES: names.join(',') };

    const { loaded } = await loadSecretsFromSsm({ env, client: client as any });

    expect(loaded).toHaveLength(23);
    expect(client.calls.map((batch) => batch.length)).toEqual([10, 10, 3]);
    expect(env.SECRET_22).toBe('secret_22');
  });

  it('propagates SSM errors so the service refuses to start', async () => {
    const client = { send: jest.fn().mockRejectedValue(new Error('AccessDeniedException')) };
    const env: NodeJS.ProcessEnv = { SSM_SECRETS_PREFIX: '/p/', SSM_SECRET_NAMES: 'SESSION' };
    await expect(loadSecretsFromSsm({ env, client: client as any })).rejects.toThrow('AccessDeniedException');
  });
});

describe('loadSecretsOnce', () => {
  it('is a no-op when no prefix is configured', async () => {
    const saved = process.env.SSM_SECRETS_PREFIX;
    delete process.env.SSM_SECRETS_PREFIX;
    try {
      await expect(loadSecretsOnce()).resolves.toEqual({ loaded: [], skipped: [] });
    } finally {
      if (saved !== undefined) process.env.SSM_SECRETS_PREFIX = saved;
    }
  });
});
