const express = require('express');
const { ofetch } = require('ofetch');
const githubProxy = require('./middleware/github-proxy');
const dockerProxy = require('./middleware/docker-proxy');
const { getHomePage } = require('./utils/combined-homepage');

const app = express();
const PORT = process.env.PORT || 8088;

app.use(express.raw({ type: '*/*', limit: '500mb' }));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, HEAD');
  res.header('Access-Control-Allow-Headers', '*');
  res.header('Access-Control-Expose-Headers', '*');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

app.get('/', (req, res) => {
  res.set({
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'public, max-age=3600'
  });
  res.send(getHomePage());
});

app.all('/*path', async (req, res, next) => {
  try {
    let pathname = req.params.path || '';
    if (Array.isArray(pathname)) {
      pathname = pathname.join('/');
    }
    console.log('Proxy request:', req.method, pathname);
    
    if (isDockerRequest(pathname)) {
      req.proxyType = 'docker';
      return dockerProxy(req, res, next);
    } else {
      req.proxyType = 'github';
      return githubProxy(req, res, next);
    }
    
  } catch (error) {
    console.error('Proxy request failed:', error);
    res.status(500).json({ error: `Proxy failed: ${error.message}` });
  }
});

function isDockerRequest(pathname) {
  if (typeof pathname !== 'string') {
    pathname = String(pathname || '');
  }
  
  if (pathname.startsWith('https://') || pathname.startsWith('http://')) {
    return false;
  }
  
  if (pathname.includes('github.com') || pathname.includes('githubusercontent.com')) {
    return false;
  }
  
  const dockerPatterns = [
    /^v2\//,
    /^[^\/]+:[^\/]+$/,
    /^[^\/]+\/[^\/]+:[^\/]+$/,
    /^ghcr\.io\//,
    /^quay\.io\//,
    /^gcr\.io\//,
    /^k8s\.gcr\.io\//
  ];
  
  return dockerPatterns.some(pattern => pattern.test(pathname));
}

app.use((error, req, res, next) => {
  console.error('Express error:', error);
  res.status(500).json({ error: `Server error: ${error.message}` });
});

app.listen(PORT, () => {
  console.log(`Combined GitHub & Docker Proxy Server running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} for usage instructions`);
});

module.exports = app;