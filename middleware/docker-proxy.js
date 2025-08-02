const { ofetch } = require('ofetch');
const {
  parseDockerRequest,
  buildRegistryUrl,
  buildDockerProxyHeaders,
  buildDockerProxyResponse,
  parseAuthenticateHeader
} = require('../utils/docker-utils');
const { getRegistryToken } = require('../utils/docker-auth');

async function dockerProxy(req, res, next) {
  try {
    let pathname = req.params.path || '';
    if (Array.isArray(pathname)) {
      pathname = pathname.join('/');
    }
    
    const dockerRequest = parseDockerRequest(pathname);
    if (!dockerRequest) {
      return res.status(400).json({ error: 'Invalid Docker request path' });
    }
    
    console.log('Docker proxy request:', req.method, dockerRequest);
    
    const targetUrl = buildRegistryUrl(dockerRequest);
    
    return await handleDockerRequest(req, res, targetUrl, dockerRequest);
    
  } catch (error) {
    console.error('Docker proxy request failed:', error);
    next(error);
  }
}

async function handleDockerRequest(req, res, targetUrl, dockerRequest) {
  const isBlob = dockerRequest.type === 'blob';
  
  console.log('Docker request details:', {
    method: req.method,
    targetUrl,
    dockerRequest,
    userAgent: req.get('user-agent')
  });
  
  let headers = buildDockerProxyHeaders(req, targetUrl, null);
  let requestConfig = {
    method: req.method,
    headers: headers,
    retry: 1,
    retryStatusCodes: [429, 500, 502, 503, 504],
    timeout: 60000  // 增加超时时间
  };
  
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    requestConfig.body = req.body;
  }
  
  let response = await ofetch.raw(targetUrl, requestConfig);
  
  // 处理 401 未授权错误
  if (response.status === 401) {
    console.log('401 Unauthorized for', dockerRequest.registry, 'repository:', dockerRequest.repository);
    const authHeader = response.headers.get('www-authenticate');
    console.log('WWW-Authenticate header:', authHeader);
    
    if (authHeader && (authHeader.includes('Bearer') || authHeader.includes('bearer'))) {
      console.log('Bearer authentication required for', dockerRequest.registry);
      
      const authParams = parseAuthenticateHeader(authHeader);
      console.log('Parsed auth params:', authParams);
      
      // 尝试获取 token
      const token = await getRegistryToken(dockerRequest.registry, dockerRequest.repository, authParams);
      if (token) {
        console.log('Successfully got token for', dockerRequest.registry, ', retrying request');
        headers = buildDockerProxyHeaders(req, targetUrl, token);
        requestConfig.headers = headers;
        try {
          response = await ofetch.raw(targetUrl, requestConfig);
          console.log('Retry with token result:', response.status);
        } catch (retryError) {
          console.error('Retry with token failed:', retryError.message);
        }
      } else {
        console.log('Failed to get token for', dockerRequest.registry, ', trying anonymous access');
        // 对于公共仓库，尝试匿名访问
        if (dockerRequest.repository && !dockerRequest.repository.includes('private')) {
          console.log('Attempting anonymous access for public repository');
          // 移除所有认证头信息，尝试匿名访问
          const anonHeaders = buildDockerProxyHeaders(req, targetUrl, null);
          delete anonHeaders['authorization'];
          delete anonHeaders['Authorization'];
          try {
            response = await ofetch.raw(targetUrl, {
              ...requestConfig,
              headers: anonHeaders
            });
            console.log('Anonymous access result:', response.status);
          } catch (anonError) {
            console.error('Anonymous access failed:', anonError.message);
          }
        }
      }
    } else {
      console.log('No Bearer auth header found, response will return 401');
    }
  }
  
  let redirectCount = 0;
  const maxRedirects = 5;
  
  while ((response.status === 307 || response.status === 302) && redirectCount < maxRedirects) {
    const redirectUrl = response.headers.get('location');
    if (!redirectUrl) {
      break;
    }
    
    console.log(`Following redirect ${redirectCount + 1} for ${dockerRequest.type}:`, redirectUrl);
    
    if (isBlob) {
      const redirectHeaders = {
        'User-Agent': 'Docker/24.0.0 Express-Proxy/1.0'
      };
      
      const rangeHeader = req.get('range');
      if (rangeHeader) {
        redirectHeaders['Range'] = rangeHeader;
      }
      
      response = await ofetch.raw(redirectUrl, {
        method: req.method,
        headers: redirectHeaders,
        retry: 2,
        timeout: 60000
      });
    } else {
      const redirectHeaders = buildDockerProxyHeaders(req, redirectUrl, null);
      response = await ofetch.raw(redirectUrl, {
        method: req.method,
        headers: redirectHeaders,
        retry: 2,
        timeout: 30000
      });
    }
    
    redirectCount++;
  }
  
  if (redirectCount >= maxRedirects) {
    console.error('Too many redirects, stopping at', maxRedirects);
    return res.status(508).json({ error: 'Too many redirects' });
  }
  
  console.log('Registry response:', response.status, response.headers.get('content-type'));
  
  const responseHeaders = buildDockerProxyResponse(response);
  
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

module.exports = dockerProxy;