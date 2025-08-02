function parseGitHubUrl(pathname) {
  if (typeof pathname !== 'string') {
    pathname = String(pathname || '');
  }
  let cleanPath = pathname.replace(/^\/+/, '');
  
  const githubDomains = [
    'github.com',
    'raw.githubusercontent.com',
    'gist.githubusercontent.com',
    'objects.githubusercontent.com',
    'codeload.github.com'
  ];
  
  if (cleanPath.startsWith('https://')) {
    const url = new URL(cleanPath);
    if (githubDomains.includes(url.hostname)) {
      return cleanPath;
    }
  }
  
  for (const domain of githubDomains) {
    if (cleanPath.startsWith(domain + '/')) {
      return 'https://' + cleanPath;
    }
  }
  
  if (cleanPath.length > 0 && !cleanPath.startsWith('http')) {
    return 'https://github.com/' + cleanPath;
  }
  
  return null;
}

function detectRequestType(request, targetUrl) {
  const url = new URL(targetUrl);
  const userAgent = request.get('user-agent') || '';
  const contentType = request.get('content-type') || '';
  
  const originalUrl = new URL(request.protocol + '://' + request.get('host') + request.originalUrl);
  const hasGitService = originalUrl.searchParams.has('service');
  const isGitUserAgent = userAgent.includes('git/') || userAgent.includes('Git/');
  const isGitPath = targetUrl.includes('/info/refs') || targetUrl.includes('/git-upload-pack') || targetUrl.includes('/git-receive-pack');
  const isGitContentType = contentType.includes('application/x-git');
  
  if (hasGitService || isGitUserAgent || isGitPath || isGitContentType) {
    return 'git';
  }
  
  if (url.hostname === 'raw.githubusercontent.com' || 
      url.hostname === 'gist.githubusercontent.com' ||
      url.hostname === 'objects.githubusercontent.com' ||
      url.hostname === 'codeload.github.com') {
    return 'file';
  }
  
  if (url.hostname === 'github.com') {
    if (url.pathname.includes('/releases/download/')) {
      return 'file';
    }
    return 'git';
  }
  
  return 'file';
}

function buildGitProxyHeaders(originalRequest, targetUrl) {
  const headers = {};
  
  for (const [key, value] of Object.entries(originalRequest.headers)) {
    if (Array.isArray(value)) {
      headers[key] = value[0];
    } else {
      headers[key] = value;
    }
  }
  
  const targetHost = new URL(targetUrl).host;
  headers['host'] = targetHost;
  
  if (!headers['user-agent']) {
    headers['user-agent'] = 'git/2.34.1';
  }
  
  delete headers['cf-ray'];
  delete headers['cf-connecting-ip'];
  delete headers['cf-visitor'];
  delete headers['x-forwarded-for'];
  delete headers['x-forwarded-proto'];
  
  return headers;
}

function buildFileProxyHeaders(originalRequest, targetUrl) {
  const headers = {};
  
  const keepHeaders = ['accept', 'accept-language', 'cache-control', 'range'];
  for (const key of keepHeaders) {
    const value = originalRequest.get(key);
    if (value) {
      headers[key] = value;
    }
  }
  
  const targetHost = new URL(targetUrl).host;
  headers['host'] = targetHost;
  
  if (!headers['user-agent']) {
    headers['user-agent'] = 'Mozilla/5.0 (compatible; GitHub-Proxy/1.0)';
  }
  
  const removeHeaders = ['cf-ray', 'cf-connecting-ip', 'cf-visitor', 'x-forwarded-for', 'x-forwarded-proto'];
  removeHeaders.forEach(header => delete headers[header]);
  
  return headers;
}

function buildGitProxyResponse(response) {
  const headers = {};
  
  for (const [key, value] of response.headers.entries()) {
    headers[key] = value;
  }
  
  const removeHeaders = [
    'content-security-policy',
    'x-frame-options', 
    'strict-transport-security',
    'x-content-type-options',
    'referrer-policy'
  ];
  
  removeHeaders.forEach(header => delete headers[header]);
  
  headers['access-control-allow-origin'] = '*';
  headers['access-control-allow-methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
  headers['access-control-allow-headers'] = '*';
  headers['access-control-expose-headers'] = '*';
  headers['x-github-proxy'] = 'Express-Git';
  
  return headers;
}

function buildFileProxyResponse(response) {
  const headers = {};
  
  const keepHeaders = [
    'content-type', 'content-length', 'content-disposition',
    'cache-control', 'expires', 'last-modified', 'etag', 'accept-ranges'
  ];
  
  for (const key of keepHeaders) {
    const value = response.headers.get(key);
    if (value) {
      headers[key] = value;
    }
  }
  
  headers['access-control-allow-origin'] = '*';
  headers['access-control-allow-methods'] = 'GET, HEAD, OPTIONS';
  headers['access-control-allow-headers'] = 'Range, Accept, Accept-Encoding';
  headers['access-control-expose-headers'] = 'Content-Length, Content-Range, Accept-Ranges';
  headers['x-github-proxy'] = 'Express-File';
  
  return headers;
}

module.exports = {
  parseGitHubUrl,
  detectRequestType,
  buildGitProxyHeaders,
  buildFileProxyHeaders,
  buildGitProxyResponse,
  buildFileProxyResponse
};