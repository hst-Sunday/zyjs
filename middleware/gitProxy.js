const fetch = require('node-fetch').default || require('node-fetch');

async function gitProxy(req, res, next) {
  try {
    const targetUrl = req.targetUrl;
    
    const headers = {};
    
    for (const [key, value] of Object.entries(req.headers)) {
      if (Array.isArray(value)) {
        headers[key] = value[0];
      } else {
        headers[key] = value;
      }
    }
    
    const targetHost = new URL(targetUrl).host;
    headers['host'] = targetHost;
    
    if (!headers['user-agent']) {
      headers['user-agent'] = 'git/2.34.1';
    }
    
    delete headers['cf-ray'];
    delete headers['cf-connecting-ip'];
    delete headers['cf-visitor'];
    delete headers['x-forwarded-for'];
    delete headers['x-forwarded-proto'];
    
    const requestConfig = {
      method: req.method,
      headers: headers,
      redirect: 'manual'
    };
    
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      requestConfig.body = req.body;
    }
    
    console.log('Git代理请求:', req.method, targetUrl);
    
    const response = await fetch(targetUrl, requestConfig);
    
    console.log('GitHub响应:', response.status, response.headers.get('content-type'));
    
    const responseHeaders = {};
    for (const [key, value] of response.headers.entries()) {
      responseHeaders[key] = value;
    }
    
    const removeHeaders = [
      'content-security-policy',
      'x-frame-options', 
      'strict-transport-security',
      'x-content-type-options',
      'referrer-policy'
    ];
    
    removeHeaders.forEach(header => delete responseHeaders[header]);
    
    responseHeaders['access-control-allow-origin'] = '*';
    responseHeaders['access-control-allow-methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
    responseHeaders['access-control-allow-headers'] = '*';
    responseHeaders['access-control-expose-headers'] = '*';
    responseHeaders['x-github-proxy'] = 'Express';
    
    res.status(response.status);
    res.set(responseHeaders);
    
    if (response.body) {
      response.body.pipe(res);
    } else {
      res.end();
    }
    
  } catch (error) {
    console.error('Git代理失败:', error);
    next(error);
  }
}

module.exports = gitProxy;