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

function buildDockerProxyResponse(response) {
  const headers = {};
  
  const keepHeaders = [
    'content-type', 'content-length', 'docker-content-digest',
    'docker-distribution-api-version', 'etag', 'last-modified',
    'cache-control', 'expires', 'accept-ranges', 'content-range'
  ];
  
  for (const key of keepHeaders) {
    const value = response.headers.get(key);
    if (value) {
      headers[key] = value;
    }
  }
  
  headers['access-control-allow-origin'] = '*';
  headers['access-control-allow-methods'] = 'GET, HEAD, OPTIONS';
  headers['access-control-allow-headers'] = 'Authorization, Content-Type, Accept, Docker-Content-Digest';
  headers['access-control-expose-headers'] = 'Docker-Content-Digest, Content-Length, Content-Type';
  headers['x-docker-proxy'] = 'Express';
  
  return headers;
}

function parseAuthenticateHeader(authHeader) {
  const params = {};
  if (!authHeader) return params;
  
  const bearerMatch = authHeader.match(/Bearer\s+(.+)/i);
  if (bearerMatch) {
    const paramString = bearerMatch[1];
    const paramMatches = paramString.matchAll(/(\w+)="([^"]+)"/g);
    for (const match of paramMatches) {
      params[match[1]] = match[2];
    }
  }
  
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