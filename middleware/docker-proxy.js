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
  
  let headers = buildDockerProxyHeaders(req, targetUrl, null);
  let requestConfig = {
    method: req.method,
    headers: headers,
    retry: 1,
    retryStatusCodes: [429, 500, 502, 503, 504],
    timeout: 30000
  };
  
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    requestConfig.body = req.body;
  }
  
  let response = await ofetch.raw(targetUrl, requestConfig);
  
  if (response.status === 401) {
    const authHeader = response.headers.get('www-authenticate');
    if (authHeader && authHeader.includes('Bearer')) {
      console.log('401 Auth required for', dockerRequest.registry, 'repository:', dockerRequest.repository);
      
      const authParams = parseAuthenticateHeader(authHeader);
      console.log('Auth params:', authParams);
      
      const token = await getRegistryToken(dockerRequest.registry, dockerRequest.repository, authParams);
      if (token) {
        console.log('Got token for', dockerRequest.registry, ', retrying request');
        headers = buildDockerProxyHeaders(req, targetUrl, token);
        requestConfig.headers = headers;
        response = await ofetch.raw(targetUrl, requestConfig);
      } else {
        console.log('Failed to get token for', dockerRequest.registry);
      }
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