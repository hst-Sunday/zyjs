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
  
  // 对于 GHCR，提供额外的诊断信息
  if (dockerRequest.registry === 'ghcr.io') {
    console.log('GHCR Repository Analysis:');
    console.log('- Registry:', dockerRequest.registry);
    console.log('- Repository:', dockerRequest.repository);
    console.log('- Request type:', dockerRequest.type);
    
    if (dockerRequest.repository) {
      const repoParts = dockerRequest.repository.split('/');
      if (repoParts.length >= 2) {
        const owner = repoParts[0];
        const repoName = repoParts.slice(1).join('/');
        console.log('- Owner:', owner);
        console.log('- Repository name:', repoName);
        console.log('- GitHub URL: https://github.com/' + owner + '/' + repoName);
        console.log('- GHCR URL: https://github.com/' + owner + '/' + repoName + '/pkgs/container/' + repoName);
      }
    }
  }
  
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
  
  let response;
  let authRequired = false;
  let authHeader = null;
  
  // 先尝试发起请求，捕获 401 异常
  try {
    response = await ofetch.raw(targetUrl, requestConfig);
  } catch (error) {
    console.log('Initial request failed:', error.message);
    
    // 检查是否是 401 错误
    if (error.status === 401 || error.message.includes('401') || error.message.includes('Unauthorized')) {
      console.log('Detected 401 error in exception');
      authRequired = true;
      
      // 尝试从错误对象中提取响应信息
      if (error.response) {
        authHeader = error.response.headers?.get?.('www-authenticate') || 
                    error.response.headers?.['www-authenticate'];
        console.log('Extracted auth header from error:', authHeader);
      }
      
      // 如果没有从错误中获取到，尝试直接请求获取认证信息
      if (!authHeader) {
        console.log('No auth header from error, trying direct request for auth info');
        try {
          const authResponse = await ofetch.raw(targetUrl, {
            method: 'GET',
            headers: { 'User-Agent': requestConfig.headers['User-Agent'] || 'Docker/24.0.0' },
            timeout: 10000
          });
        } catch (authError) {
          if (authError.response) {
            authHeader = authError.response.headers?.get?.('www-authenticate') || 
                        authError.response.headers?.['www-authenticate'];
            console.log('Got auth header from auth request:', authHeader);
          }
        }
      }
    } else {
      // 非 401 错误，直接抛出
      throw error;
    }
  }
  
  // 处理 401 未授权错误 (无论是响应还是异常)
  if ((response && response.status === 401) || authRequired) {
    console.log('401 Unauthorized for', dockerRequest.registry, 'repository:', dockerRequest.repository);
    
    // 优先使用从响应中获取的 auth header
    if (!authHeader && response) {
      authHeader = response.headers.get('www-authenticate');
    }
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
        console.log('Failed to get token for', dockerRequest.registry, ', trying enhanced anonymous access');
        
        // 对于 GHCR，尝试特殊的匿名访问策略
        if (dockerRequest.registry === 'ghcr.io') {
          console.log('Attempting GHCR-specific anonymous access strategies');
          
          // 策略 1：完全无认证访问
          try {
            const cleanHeaders = {
              'User-Agent': req.get('user-agent') || 'Docker/24.0.0 Express-Proxy/1.0',
              'Accept': req.get('accept') || 'application/vnd.docker.distribution.manifest.v2+json'
            };
            
            response = await ofetch.raw(targetUrl, {
              method: req.method,
              headers: cleanHeaders,
              timeout: 30000
            });
            console.log('GHCR clean anonymous access succeeded:', response.status);
          } catch (cleanError) {
            console.log('GHCR clean anonymous access failed:', cleanError.message);
            
            // 策略 2：使用空的 Authorization 头
            try {
              const emptyAuthHeaders = {
                'User-Agent': req.get('user-agent') || 'Docker/24.0.0 Express-Proxy/1.0',
                'Accept': req.get('accept') || 'application/vnd.docker.distribution.manifest.v2+json',
                'Authorization': 'Bearer '
              };
              
              response = await ofetch.raw(targetUrl, {
                method: req.method,
                headers: emptyAuthHeaders,
                timeout: 30000
              });
              console.log('GHCR empty auth access succeeded:', response.status);
            } catch (emptyAuthError) {
              console.log('GHCR empty auth access failed:', emptyAuthError.message);
              
              // 所有 GHCR 策略都失败
              return res.status(401).json({
                error: 'GHCR authentication required - repository may be private or require GitHub credentials',
                registry: dockerRequest.registry,
                repository: dockerRequest.repository,
                suggestion: 'Verify repository visibility or provide GitHub PAT authentication'
              });
            }
          }
        } else {
          // 非 GHCR 的原有匿名访问逻辑
          if (dockerRequest.repository && !dockerRequest.repository.includes('private')) {
            console.log('Attempting standard anonymous access for public repository');
            const anonHeaders = buildDockerProxyHeaders(req, targetUrl, null);
            delete anonHeaders['authorization'];
            delete anonHeaders['Authorization'];
            try {
              response = await ofetch.raw(targetUrl, {
                ...requestConfig,
                headers: anonHeaders
              });
              console.log('Standard anonymous access result:', response.status);
            } catch (anonError) {
              console.error('Standard anonymous access failed:', anonError.message);
              return res.status(401).json({ 
                error: 'Authentication required and failed',
                registry: dockerRequest.registry,
                repository: dockerRequest.repository
              });
            }
          } else {
            return res.status(401).json({
              error: 'Authentication required for private repository',
              registry: dockerRequest.registry,
              repository: dockerRequest.repository
            });
          }
        }
      }
    } else {
      console.log('No Bearer auth header found for', dockerRequest.registry);
      
      // 对于 GHCR，提供更详细的诊断信息
      if (dockerRequest.registry === 'ghcr.io') {
        return res.status(401).json({
          error: 'GHCR authentication required',
          registry: dockerRequest.registry,
          repository: dockerRequest.repository,
          diagnosis: {
            possible_causes: [
              'Repository may be private and require GitHub authentication',
              'Repository may not exist or be accessible',
              'GHCR may require different authentication method'
            ],
            suggestions: [
              'Verify repository exists and is public: https://github.com/' + dockerRequest.repository.split('/')[0],
              'Check repository visibility settings in GitHub',
              'Try accessing with GitHub Personal Access Token if private'
            ]
          }
        });
      } else {
        return res.status(401).json({
          error: 'No Bearer authentication found',
          registry: dockerRequest.registry,
          repository: dockerRequest.repository
        });
      }
    }
  }
  
  // 确保 response 对象存在
  if (!response) {
    console.error('No response object available after authentication attempts');
    return res.status(500).json({
      error: 'Internal server error: no response available',
      registry: dockerRequest.registry,
      repository: dockerRequest.repository
    });
  }
  
  let redirectCount = 0;
  const maxRedirects = 5;
  
  // 确保 response 存在且有 status 属性
  while (response && (response.status === 307 || response.status === 302) && redirectCount < maxRedirects) {
    const redirectUrl = response.headers.get('location');
    if (!redirectUrl) {
      break;
    }
    
    console.log(`Following redirect ${redirectCount + 1} for ${dockerRequest.type}:`, redirectUrl);
    
    if (isBlob) {
      console.log('Following blob redirect:', redirectUrl);
      const redirectHeaders = {
        'User-Agent': 'Docker/24.0.0 Express-Proxy/1.0'
      };
      
      const rangeHeader = req.get('range');
      if (rangeHeader) {
        redirectHeaders['Range'] = rangeHeader;
        console.log('Preserving Range header for blob redirect:', rangeHeader);
      }
      
      // 保留认证头信息用于重定向
      const authHeader = req.get('authorization');
      if (authHeader) {
        redirectHeaders['Authorization'] = authHeader;
      }
      
      response = await ofetch.raw(redirectUrl, {
        method: req.method,
        headers: redirectHeaders,
        retry: 2,
        timeout: 60000
      });
      
      console.log('Blob redirect response:', response.status, 'Content-Length:', response.headers.get('content-length'));
    } else {
      console.log('Following non-blob redirect:', redirectUrl);
      const redirectHeaders = buildDockerProxyHeaders(req, redirectUrl, null);
      
      response = await ofetch.raw(redirectUrl, {
        method: req.method,
        headers: redirectHeaders,
        retry: 2,
        timeout: 30000
      });
      
      console.log('Non-blob redirect response:', response.status, 'Content-Length:', response.headers.get('content-length'));
    }
    
    redirectCount++;
  }
  
  if (redirectCount >= maxRedirects) {
    console.error('Too many redirects, stopping at', maxRedirects);
    return res.status(508).json({ error: 'Too many redirects' });
  }
  
  const contentType = response.headers.get('content-type') || '';
  const contentLength = response.headers.get('content-length');
  console.log('Registry response:', response.status, contentType, 'Content-Length:', contentLength);
  console.log('Docker request type:', dockerRequest.type, 'HTTP method:', req.method);
  
  const responseHeaders = buildDockerProxyResponse(response, dockerRequest, req);
  
  // 特殊处理 HEAD 请求的 Content-Length
  if (req.method === 'HEAD') {
    console.log('Processing HEAD request for', dockerRequest.type);
    
    if (dockerRequest.type === 'manifest') {
      // 对于 manifest HEAD 请求，确保 Content-Length 反映实际 manifest 大小
      const actualContentLength = contentLength;
      if (actualContentLength && actualContentLength !== '0') {
        responseHeaders['content-length'] = actualContentLength;
        console.log('HEAD manifest: preserving Content-Length =', actualContentLength);
      } else {
        // 如果没有 Content-Length，但有 response._data，使用实际数据大小
        if (response._data) {
          const dataSize = Buffer.isBuffer(response._data) ? response._data.length : 
                          (typeof response._data === 'string' ? Buffer.byteLength(response._data, 'utf8') : 0);
          if (dataSize > 0) {
            responseHeaders['content-length'] = dataSize.toString();
            console.log('HEAD manifest: calculated Content-Length =', dataSize);
          }
        }
      }
    } else if (dockerRequest.type === 'blob') {
      // 对于 blob HEAD 请求，确保 Content-Length 正确
      if (actualContentLength && actualContentLength !== '0') {
        responseHeaders['content-length'] = actualContentLength;
        console.log('HEAD blob: preserving Content-Length =', actualContentLength);
      }
    }
  }
  
  res.status(response.status);
  res.set(responseHeaders);
  
  // containerd 兼容性处理：检查 Content-Length 是否与实际数据匹配
  const expectedLength = parseInt(responseHeaders['content-length'] || '0', 10);
  let actualDataSize = 0;
  
  // 对于 blob 请求，需要特殊处理以保证数据完整性
  if (dockerRequest.type === 'blob') {
    console.log('Handling blob request with containerd-compatible processing');
    console.log('Expected Content-Length:', expectedLength);
    
    if (req.method === 'HEAD') {
      // HEAD 请求不返回 body，只返回 headers
      console.log('HEAD blob request: returning headers only');
      res.end();
    } else if (response._data) {
      // ofetch 已经读取了数据
      let finalBuffer;
      if (Buffer.isBuffer(response._data)) {
        finalBuffer = response._data;
      } else if (response._data instanceof ArrayBuffer) {
        finalBuffer = Buffer.from(response._data);
      } else if (response._data instanceof Uint8Array) {
        finalBuffer = Buffer.from(response._data);
      } else {
        try {
          const arrayBuffer = await response._data.arrayBuffer();
          finalBuffer = Buffer.from(arrayBuffer);
        } catch (conversionError) {
          console.error('Blob data conversion failed:', conversionError);
          res.status(500).json({ error: 'Blob data processing failed' });
          return;
        }
      }
      
      actualDataSize = finalBuffer.length;
      console.log('Blob _data size:', actualDataSize, 'expected:', expectedLength);
      
      // containerd 兼容性：如果实际大小与 Content-Length 不匹配，更新 header
      if (expectedLength === 0 && actualDataSize > 0) {
        console.log('Fixing zero Content-Length for containerd compatibility');
        responseHeaders['content-length'] = actualDataSize.toString();
        res.set('content-length', actualDataSize.toString());
      } else if (expectedLength !== actualDataSize && actualDataSize > 0) {
        console.log(`Content-Length mismatch: expected ${expectedLength}, actual ${actualDataSize}. Using actual size.`);
        responseHeaders['content-length'] = actualDataSize.toString();
        res.set('content-length', actualDataSize.toString());
      }
      
      res.end(finalBuffer);
    } else if (response.body) {
      // 流式处理 blob 数据，同时验证大小
      console.log('Using streaming for blob data with size validation');
      try {
        const reader = response.body.getReader();
        const chunks = [];
        let totalSize = 0;
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          totalSize += value.length;
        }
        
        console.log('Blob streaming complete, total size:', totalSize, 'expected:', expectedLength);
        
        // containerd 兼容性检查
        if (expectedLength === 0 && totalSize > 0) {
          console.log('Fixing zero Content-Length from streaming for containerd compatibility');
          res.set('content-length', totalSize.toString());
        } else if (expectedLength !== totalSize && totalSize > 0) {
          console.log(`Streaming size mismatch: expected ${expectedLength}, actual ${totalSize}. Using actual size.`);
          res.set('content-length', totalSize.toString());
        }
        
        const finalBuffer = Buffer.concat(chunks.map(chunk => Buffer.from(chunk)));
        res.end(finalBuffer);
        reader.releaseLock();
      } catch (streamError) {
        console.error('Blob streaming failed:', streamError);
        res.status(500).json({ error: 'Blob streaming failed' });
      }
    } else {
      console.log('No blob data available');
      if (req.method === 'HEAD') {
        res.end();
      } else {
        res.status(404).json({ error: 'Blob data not found' });
      }
    }
  } else {
    // 非-blob 请求的处理逻辑
    if (req.method === 'HEAD') {
      // HEAD 请求不返回 body
      res.end();
    } else if (response.body && typeof response.body.pipe === 'function') {
      response.body.pipe(res);
    } else if (response._data) {
      res.send(response._data);
    } else {
      try {
        const buffer = await response.arrayBuffer();
        res.send(Buffer.from(buffer));
      } catch (bufferError) {
        console.error('Response buffer processing failed:', bufferError);
        res.end();
      }
    }
  }
}

module.exports = dockerProxy;