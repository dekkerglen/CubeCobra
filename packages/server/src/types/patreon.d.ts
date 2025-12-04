declare module 'patreon' {
  export function patreon(accessToken: string): any;
  export function oauth(clientId: string, clientSecret: string): any;

  const patreonModule: {
    patreon: typeof patreon;
    oauth: typeof oauth;
  };

  export default patreonModule;
}
