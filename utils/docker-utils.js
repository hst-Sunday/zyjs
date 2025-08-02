const REGISTRY_CONFIGS = {
  'docker.io': 'https://registry-1.docker.io',
  'ghcr.io': 'https://ghcr.io',
  'quay.io': 'https://quay.io',
  'gcr.io': 'https://gcr.io',
  'k8s.gcr.io': 'https://k8s.gcr.io'
};

const REGISTRY_AUTH_CONFIGS = {
  'docker.io': {
    auth_url: 'https://auth.docker.io/token',
    service: 'registry.docker.io',
    scope_template: 'repository:{repository}:pull'
  },
  'ghcr.io': {
    auth_url: 'https://github.com/token',
    service: 'ghcr.io', 
    scope_template: 'repository:{repository}:pull'
  },
  'quay.io': {
    auth_url: 'https://quay.io/v2/auth',
    service: 'quay.io',
    scope_template: 'repository:{repository}:pull'
  },
  'gcr.io': {
    auth_url: 'https://gcr.io/v2/token',
    service: 'gcr.io',
    scope_template: 'repository:{repository}:pull'
  }
};

function parseDockerRequest(pathname) {
  if (typeof pathname !== 'string') {
    pathname = String(pathname || '');
  }
  let cleanPath = pathname.replace(/^\/+/, '');
  
  const registryApiMatch = cleanPath.match(/^v2\/(.*)$/);
  if (registryApiMatch) {
    const apiPath = registryApiMatch[1];
    
    if (apiPath === '') {
      return { type: 'root', registry: 'docker.io', path: '/v2/' };
    }
    
    if (apiPath === '_catalog') {
      return { type: 'catalog', registry: 'docker.io', path: '/v2/_catalog' };
    }
    
    const manifestMatch = apiPath.match(/^([^\/]+(?:\/[^\/]+)*?)\/manifests\/(.+)$/);
    if (manifestMatch) {
      const [, repository, reference] = manifestMatch;
      const registryInfo = parseRepositoryRegistry(repository);
      return {
        type: 'manifest',
        registry: registryInfo.registry,
        repository: registryInfo.repository,
        reference: reference,
        path: `/v2/${registryInfo.repository}/manifests/${reference}`
      };
    }
    
    const blobMatch = apiPath.match(/^([^\/]+(?:\/[^\/]+)*?)\/blobs\/(.+)$/);
    if (blobMatch) {
      const [, repository, digest] = blobMatch;
      const registryInfo = parseRepositoryRegistry(repository);
      return {
        type: 'blob',
        registry: registryInfo.registry,
        repository: registryInfo.repository,
        digest: digest,
        path: `/v2/${registryInfo.repository}/blobs/${digest}`
      };
    }
    
    return {
      type: 'api',
      registry: 'docker.io',
      path: `/v2/${apiPath}`
    };
  }
  
  if (cleanPath.includes(':') || cleanPath.includes('/')) {
    return parseImageReference(cleanPath);
  }
  
  return null;
}

function parseRepositoryRegistry(repository) {
  console.log('Parsing repository:', repository);
  const parts = repository.split('/');
  
  // 处理包含注册表域名的情况 (如 ghcr.io/user/repo)
  if (parts.length > 1 && parts[0].includes('.')) {
    const registry = parts[0];
    const repo = parts.slice(1).join('/');
    console.log('Detected registry:', registry, 'repo:', repo);
    return { registry: registry, repository: repo };
  }
  
  // 处理单一名称的镜像 (如 nginx)
  if (!repository.includes('/')) {
    console.log('Single name image, using docker.io/library');
    return { registry: 'docker.io', repository: 'library/' + repository };
  }
  
  // 默认使用 docker.io
  console.log('Default to docker.io for repository:', repository);
  return { registry: 'docker.io', repository: repository };
}

function parseImageReference(imageRef) {
  const parts = imageRef.split('/');
  let registry = 'docker.io';
  let repository = imageRef;
  let tag = 'latest';
  
  const tagMatch = imageRef.match(/^(.+):([^:\/]+)$/);
  if (tagMatch) {
    repository = tagMatch[1];
    tag = tagMatch[2];
  } else {
    repository = imageRef;
  }
  
  if (parts.length > 1 && parts[0].includes('.')) {
    registry = parts[0];
    repository = parts.slice(1).join('/');
    if (tagMatch) {
      repository = repository.replace(':' + tag, '');
    }
  }
  
  if (registry === 'docker.io' && !repository.includes('/')) {
    repository = 'library/' + repository;
  }
  
  return {
    type: 'image',
    registry: registry,
    repository: repository,
    tag: tag,
    reference: tag
  };
}

function buildRegistryUrl(dockerRequest) {
  const registryBaseUrl = REGISTRY_CONFIGS[dockerRequest.registry] || REGISTRY_CONFIGS['docker.io'];
  
  if (dockerRequest.path) {
    return registryBaseUrl + dockerRequest.path;
  }
  
  if (dockerRequest.type === 'image') {
    return `${registryBaseUrl}/v2/${dockerRequest.repository}/manifests/${dockerRequest.reference}`;
  }
  
  return registryBaseUrl + '/v2/';
}

function buildDockerProxyHeaders(originalRequest, targetUrl, authToken = null) {
  const headers = {};
  
  const keepHeaders = [
    'accept', 'accept-encoding', 'content-type', 'content-length',
    'docker-content-digest', 'range'
  ];
  
  for (const key of keepHeaders) {
    const value = originalRequest.get(key);
    if (value) {
      headers[key] = value;
    }
  }
  
  const targetHost = new URL(targetUrl).host;
  headers['host'] = targetHost;
  
  if (!headers['user-agent']) {
    headers['user-agent'] = 'Docker/24.0.0 Express-Proxy/1.0';
  }
  
  if (authToken) {
    headers['authorization'] = `Bearer ${authToken}`;
  }
  
  if (!headers['accept']) {
    headers['accept'] = 'application/vnd.docker.distribution.manifest.v2+json, application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.oci.image.manifest.v1+json, application/vnd.oci.image.index.v1+json';
  }
  
  const removeHeaders = ['cf-ray', 'cf-connecting-ip', 'cf-visitor', 'x-forwarded-for', 'x-forwarded-proto'];
  removeHeaders.forEach(header => delete headers[header]);
  
  return headers;
}

function buildDockerProxyResponse(response, dockerRequest = null, originalRequest = null) {
  const headers = {};
  
  // 对于 Docker 协议，这些头信息至关重要
  const keepHeaders = [
    'content-type', 'content-length', 'docker-content-digest',
    'docker-distribution-api-version', 'etag', 'last-modified',
    'cache-control', 'expires', 'accept-ranges', 'content-range',
    'content-encoding', 'transfer-encoding'
  ];
  
  for (const key of keepHeaders) {
    const value = response.headers.get(key);
    if (value) {
      headers[key] = value;
      console.log(`Preserving header: ${key} = ${value}`);
    }
  }
  
  // 特殊处理 Content-Length，遵循 Docker Registry v2 API 规范
  const contentLength = response.headers.get('content-length');
  const isHeadRequest = originalRequest && originalRequest.method === 'HEAD';
  const isManifest = dockerRequest && dockerRequest.type === 'manifest';
  const isBlob = dockerRequest && dockerRequest.type === 'blob';
  
  console.log('Content-Length processing:', {
    contentLength,
    isHeadRequest,
    isManifest,
    isBlob,
    requestType: dockerRequest?.type
  });
  
  if (contentLength) {
    if (isHeadRequest) {
      // HEAD 请求必须返回与 GET 请求相同的 Content-Length
      if (isManifest || isBlob) {
        // 对于 manifest 和 blob，确保 Content-Length 不为 0（除非真的是 0）
        headers['content-length'] = contentLength;
        console.log('HEAD request: preserving Content-Length =', contentLength);
      } else {
        headers['content-length'] = contentLength;
      }
    } else {
      // 非-HEAD 请求的正常处理
      headers['content-length'] = contentLength;
      console.log('Non-HEAD request: preserving Content-Length =', contentLength);
    }
  } else if (isHeadRequest && response._data) {
    // 如果 HEAD 请求没有 Content-Length 但有数据，计算实际大小
    const dataSize = Buffer.isBuffer(response._data) ? response._data.length : 
                    (typeof response._data === 'string' ? Buffer.byteLength(response._data, 'utf8') : 0);
    if (dataSize > 0) {
      headers['content-length'] = dataSize.toString();
      console.log('HEAD request: calculated Content-Length =', dataSize);
    }
  }
  
  // 保留所有 Docker 相关的头信息
  for (const [key, value] of response.headers.entries()) {
    const lowerKey = key.toLowerCase();
    if (lowerKey.startsWith('docker-') || lowerKey.startsWith('x-docker-') || 
        lowerKey.startsWith('www-authenticate') || lowerKey.startsWith('location')) {
      headers[key] = value;
      console.log(`Preserving Docker header: ${key} = ${value}`);
    }
  }
  
  // 对于 blob 请求，确保关键头信息存在
  if (isBlob) {
    // Docker-Content-Digest 对 blob 非常重要
    const dockerDigest = response.headers.get('docker-content-digest');
    if (dockerDigest) {
      headers['docker-content-digest'] = dockerDigest;
      console.log('Blob: ensuring Docker-Content-Digest =', dockerDigest);
    }
    
    // 对于 blob，确保 Accept-Ranges 头存在
    const acceptRanges = response.headers.get('accept-ranges');
    if (acceptRanges) {
      headers['accept-ranges'] = acceptRanges;
    }
  }
  
  // CORS 支持
  headers['access-control-allow-origin'] = '*';
  headers['access-control-allow-methods'] = 'GET, HEAD, OPTIONS, POST, PUT';
  headers['access-control-allow-headers'] = '*';
  headers['access-control-expose-headers'] = '*';
  headers['x-docker-proxy'] = 'Express-ContentLength-Fixed';
  
  return headers;
}

function parseAuthenticateHeader(authHeader) {
  console.log('Parsing auth header:', authHeader);
  const params = {};
  
  if (!authHeader) {
    console.log('No auth header provided');
    return params;
  }
  
  // 处理 Bearer 认证
  const bearerMatch = authHeader.match(/Bearer\s+(.+)/i);
  if (!bearerMatch) {
    console.log('No Bearer token found in auth header');
    return params;
  }
  
  const paramString = bearerMatch[1];
  console.log('Parsing param string:', paramString);
  
  // 更健壮的参数解析，支持带引号和不带引号的值
  const paramMatches = paramString.matchAll(/(\w+)=("([^"]+)"|([^,\s]+))/g);
  for (const match of paramMatches) {
    const key = match[1];
    const value = match[3] || match[4]; // 带引号的值或不带引号的值
    params[key] = value;
    console.log('Parsed param:', key, '=', value);
  }
  
  console.log('Final parsed params:', params);
  return params;
}

module.exports = {
  REGISTRY_CONFIGS,
  REGISTRY_AUTH_CONFIGS,
  parseDockerRequest,
  parseRepositoryRegistry,
  parseImageReference,
  buildRegistryUrl,
  buildDockerProxyHeaders,
  buildDockerProxyResponse,
  parseAuthenticateHeader
};