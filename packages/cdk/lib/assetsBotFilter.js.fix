// CloudFront viewer-request function for assets.cubecobra.com.
//
// Returns 403 for crawler user-agents that generate heavy CloudFront egress
// with no benefit to CubeCobra. In access-log analysis Amazonbot alone was
// ~50% of asset bytes, and non-search crawlers together were ~75-80%.
//
// Search-engine crawlers (Googlebot, Bingbot, DuckDuckBot, Applebot, Yandex)
// are deliberately NOT in the blocklist, so cubecobra.com stays indexed.
//
// Wired up in assets-distribution.ts as a VIEWER_REQUEST function on every
// cache behavior. To change the policy, edit BLOCKED below and redeploy the
// assets stack (CubeCobraAssetsProdStack / CubeCobraAssetsBetaStack).
//
// Matching is a lowercase substring test, so list tokens in lowercase.

function handler(event) {
  var request = event.request;
  var uaHeader = request.headers['user-agent'];
  var ua = uaHeader && uaHeader.value ? uaHeader.value.toLowerCase() : '';

  var BLOCKED = [
    'amazonbot',
    'ahrefsbot',
    'bytespider',
    'semrushbot',
    'mj12bot',
    'dotbot',
    'pulsepoint',
    'gptbot',
    'claudebot',
    'anthropic-ai',
    'ccbot',
    'perplexitybot',
    'oai-searchbot',
    'meta-externalagent',
    'imagesiftbot',
    'diffbot',
  ];

  for (var i = 0; i < BLOCKED.length; i++) {
    if (ua.indexOf(BLOCKED[i]) !== -1) {
      return {
        statusCode: 403,
        statusDescription: 'Forbidden',
        headers: {
          'content-type': { value: 'text/plain' },
          'cache-control': { value: 'no-store' },
        },
      };
    }
  }

  return request;
}
