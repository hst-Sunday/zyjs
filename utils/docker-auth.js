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
    
    const response = await ofetch.raw(tokenUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Docker/24.0.0 Express-Proxy/1.0',
        'Accept': 'application/json'
      },
      retry: 2,
      timeout: 10000
    });
    
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