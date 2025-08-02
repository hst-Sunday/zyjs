const { ofetch } = require('ofetch');
const {
  parseGitHubUrl,
  detectRequestType,
  buildGitProxyHeaders,
  buildFileProxyHeaders,
  buildGitProxyResponse,
  buildFileProxyResponse
} = require('../utils/github-utils');

async function githubProxy(req, res, next) {
  try {
    let pathname = req.params.path || '';
    if (Array.isArray(pathname)) {
      pathname = pathname.join('/');
    }
    pathname = '/' + pathname;
    const searchParams = req.originalUrl.includes('?') ? '?' + req.originalUrl.split('?')[1] : '';
    
    let targetUrl = parseGitHubUrl(pathname);
    if (!targetUrl) {
      return res.status(400).json({ error: '无效的GitHub URL' });
    }
    
    const supportedDomains = ['github.com', 'raw.githubusercontent.com', 'gist.githubusercontent.com', 'objects.githubusercontent.com', 'codeload.github.com'];
    const targetHost = new URL(targetUrl).hostname;
    if (!supportedDomains.includes(targetHost)) {
      return res.status(400).json({ error: '仅支持GitHub相关域名的代理' });
    }
    
    if (searchParams) {
      targetUrl += searchParams;
    }
    
    const requestType = detectRequestType(req, targetUrl);
    console.log('GitHub代理请求:', req.method, targetUrl, '类型:', requestType);
    
    if (requestType === 'git') {
      return await handleGitProxy(req, res, targetUrl);
    } else {
      return await handleFileProxy(req, res, targetUrl);
    }
    
  } catch (error) {
    console.error('GitHub代理失败:', error);
    next(error);
  }
}

async function handleGitProxy(req, res, targetUrl) {
  const headers = buildGitProxyHeaders(req, targetUrl);
  
  const requestConfig = {
    method: req.method,
    headers: headers,
    retry: 2,
    retryStatusCodes: [429, 500, 502, 503, 504],
    timeout: 30000
  };
  
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    requestConfig.body = req.body;
  }
  
  console.log('Git代理请求:', req.method, targetUrl);
  
  const response = await ofetch.raw(targetUrl, requestConfig);
  
  console.log('GitHub响应:', response.status, response.headers.get('content-type'));
  
  const responseHeaders = buildGitProxyResponse(response);
  
  res.status(response.status);
  res.set(responseHeaders);
  
  if (response.body && typeof response.body.pipe === 'function') {
    response.body.pipe(res);
  } else if (response._data) {
    res.send(response._data);
  } else {
    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  }
}

async function handleFileProxy(req, res, targetUrl) {
  const headers = buildFileProxyHeaders(req, targetUrl);
  
  const requestConfig = {
    method: req.method,
    headers: headers,
    retry: 3,
    retryStatusCodes: [429, 500, 502, 503, 504],
    timeout: 60000
  };
  
  console.log('文件代理请求:', req.method, targetUrl);
  
  const response = await ofetch.raw(targetUrl, requestConfig);
  
  console.log('GitHub文件响应:', response.status, response.headers.get('content-type'));
  
  const responseHeaders = buildFileProxyResponse(response);
  
  res.status(response.status);
  res.set(responseHeaders);
  
  if (response.body && typeof response.body.pipe === 'function') {
    response.body.pipe(res);
  } else if (response._data) {
    res.send(response._data);
  } else {
    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  }
}

module.exports = githubProxy;