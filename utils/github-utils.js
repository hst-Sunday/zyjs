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
  const accept = request.get('accept') || '';
  
  const originalUrl = new URL(request.protocol + '://' + request.get('host') + request.originalUrl);
  const hasGitService = originalUrl.searchParams.has('service');
  const isGitUserAgent = userAgent.includes('git/') || userAgent.includes('Git/') || userAgent.includes('JGit/') || userAgent.includes('libgit2');
  const isGitPath = targetUrl.includes('/info/refs') || targetUrl.includes('/git-upload-pack') || targetUrl.includes('/git-receive-pack');
  const isGitContentType = contentType.includes('application/x-git');
  const isGitAccept = accept.includes('application/x-git');
  
  // 增强的 Git 请求检测
  if (hasGitService || isGitUserAgent || isGitPath || isGitContentType || isGitAccept) {
    console.log('检测到Git请求:', {
      hasGitService,
      isGitUserAgent,
      isGitPath,
      isGitContentType,
      isGitAccept,
      userAgent,
      targetUrl
    });
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
  
  // 保持原始 User-Agent 或设置合适的默认值
  if (!headers['user-agent']) {
    headers['user-agent'] = 'git/2.39.0 (GitHub-Proxy)';
  }
  
  // 清理代理相关头信息
  const proxyHeaders = [
    'cf-ray', 'cf-connecting-ip', 'cf-visitor', 
    'x-forwarded-for', 'x-forwarded-proto', 'x-real-ip',
    'x-original-forwarded-for', 'forwarded'
  ];
  proxyHeaders.forEach(header => delete headers[header]);
  
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
  
  // Git Smart HTTP 协议需要保留的关键头信息
  const gitCriticalHeaders = [
    'content-type',
    'content-length', 
    'transfer-encoding',
    'cache-control',
    'expires',
    'pragma',
    'www-authenticate',
    'x-git-upload-pack-advertisement',
    'x-git-receive-pack-advertisement'
  ];
  
  // 保留 Git 关键头信息
  for (const key of gitCriticalHeaders) {
    const value = response.headers.get(key);
    if (value) {
      headers[key] = value;
    }
  }
  
  // 保留其他重要的响应头
  for (const [key, value] of response.headers.entries()) {
    const lowerKey = key.toLowerCase();
    if (lowerKey.startsWith('x-git-') || lowerKey.startsWith('x-ratelimit-') || 
        lowerKey === 'location' || lowerKey === 'date' || lowerKey === 'server') {
      headers[key] = value;
    }
  }
  
  // 移除可能干扰的安全头
  const removeHeaders = [
    'content-security-policy',
    'x-frame-options', 
    'strict-transport-security',
    'x-content-type-options',
    'referrer-policy',
    'content-encoding',  // 重要：移除编码头避免解码错误
    'content-range'      // 避免 range 请求冲突
  ];
  
  removeHeaders.forEach(header => delete headers[header]);
  
  // 添加 CORS 支持
  headers['access-control-allow-origin'] = '*';
  headers['access-control-allow-methods'] = 'GET, POST, PUT, DELETE, OPTIONS, HEAD';
  headers['access-control-allow-headers'] = '*';
  headers['access-control-expose-headers'] = '*';
  headers['x-github-proxy'] = 'Express-Git-Enhanced';
  
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