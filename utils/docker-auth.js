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
    
    if (response.status === 200) {
      const data = await response.json();
      return data.token;
    } else {
      console.log('Token request failed:', response.status);
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