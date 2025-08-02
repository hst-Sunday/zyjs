const { ofetch } = require('ofetch');
const { REGISTRY_AUTH_CONFIGS } = require('./docker-utils');

async function getRegistryToken(registry, repository, authParams = null) {
  try {
    const config = REGISTRY_AUTH_CONFIGS[registry];
    if (!config) {
      console.log('No auth config for registry:', registry);
      return null;
    }
    
    let authUrl = config.auth_url;
    let service = config.service;
    let scope = config.scope_template.replace('{repository}', repository);
    
    if (authParams) {
      if (authParams.realm) authUrl = authParams.realm;
      if (authParams.service) service = authParams.service;
      if (authParams.scope) scope = authParams.scope;
    }
    
    const tokenUrl = `${authUrl}?service=${service}&scope=${scope}`;
    console.log('Requesting token from:', tokenUrl);
    console.log('Registry:', registry, 'Repository:', repository);
    
    // 对于 GHCR，尝试不同的认证策略
    let response;
    let authHeaders = {
      'User-Agent': 'Docker/24.0.0 Express-Proxy/1.0',
      'Accept': 'application/json'
    };
    
    if (registry === 'ghcr.io') {
      console.log('Using GHCR-specific token request logic');
      
      // 先尝试匿名访问
      try {
        response = await ofetch.raw(tokenUrl, {
          method: 'GET',
          headers: authHeaders,
          retry: 1,
          timeout: 15000
        });
        console.log('GHCR anonymous token request succeeded');
      } catch (anonymousError) {
        console.log('GHCR anonymous token request failed:', anonymousError.status, anonymousError.message);
        
        if (anonymousError.status === 403) {
          console.log('GHCR 403 error: trying alternative authentication methods');
          
          // 策略 1：使用空的 Basic 认证（模拟匿名访问）
          const emptyAuth = Buffer.from(':').toString('base64');
          const basicAuthHeaders = { ...authHeaders, 'Authorization': `Basic ${emptyAuth}` };
          
          try {
            response = await ofetch.raw(tokenUrl, {
              method: 'GET',
              headers: basicAuthHeaders,
              retry: 1,
              timeout: 15000
            });
            console.log('GHCR empty Basic auth succeeded');
          } catch (basicError) {
            console.log('GHCR Basic auth failed:', basicError.status, basicError.message);
            
            // 策略 2：尝试修改 scope 格式
            if (scope.includes(':')) {
              const altScope = scope.replace(':', '/');
              const altTokenUrl = `${authUrl}?service=${service}&scope=${altScope}`;
              console.log('Trying alternative scope format:', altTokenUrl);
              
              try {
                response = await ofetch.raw(altTokenUrl, {
                  method: 'GET',
                  headers: authHeaders,
                  retry: 1,
                  timeout: 15000
                });
                console.log('GHCR alternative scope succeeded');
              } catch (altScopeError) {
                console.log('GHCR alternative scope failed:', altScopeError.status, altScopeError.message);
                
                // 策略 3：尝试无 scope 请求
                const noScopeUrl = `${authUrl}?service=${service}`;
                console.log('Trying no-scope request:', noScopeUrl);
                
                try {
                  response = await ofetch.raw(noScopeUrl, {
                    method: 'GET',
                    headers: authHeaders,
                    retry: 1,
                    timeout: 15000
                  });
                  console.log('GHCR no-scope request succeeded');
                } catch (noScopeError) {
                  console.log('GHCR no-scope request failed:', noScopeError.status, noScopeError.message);
                  console.log('All GHCR token acquisition methods failed');
                  return null;
                }
              }
            } else {
              console.log('All GHCR token acquisition methods failed');
              return null;
            }
          }
        } else {
          // 非 403 错误，直接抛出
          throw anonymousError;
        }
      }
    } else {
      // 非 GHCR 的原有逻辑
      response = await ofetch.raw(tokenUrl, {
        method: 'GET',
        headers: authHeaders,
        retry: 2,
        timeout: 10000
      });
    }
    
    console.log('Token response status:', response.status);
    console.log('Token response headers:', Object.fromEntries(response.headers.entries()));
    
    if (response.status === 200) {
      // 使用 response._data 而不是 response.json() 避免 body 被重复读取
      let data;
      if (response._data) {
        try {
          data = typeof response._data === 'string' ? JSON.parse(response._data) : response._data;
        } catch (parseError) {
          console.error('Failed to parse token response data:', parseError);
          return null;
        }
      } else {
        // 如果没有 _data，尝试使用 .text() 方法
        try {
          const text = await response.text();
          data = JSON.parse(text);
        } catch (readError) {
          console.error('Failed to read token response:', readError);
          return null;
        }
      }
      
      console.log('Token response data:', data);
      return data.token || data.access_token;
    } else {
      console.log('Token request failed:', response.status);
      if (response._data) {
        console.log('Error response data:', response._data);
      }
    }
  } catch (error) {
    console.error(`Failed to get ${registry} token:`, error);
  }
  
  return null;
}

async function getDockerHubToken(repository) {
  return await getRegistryToken('docker.io', repository);
}

module.exports = {
  getRegistryToken,
  getDockerHubToken
};