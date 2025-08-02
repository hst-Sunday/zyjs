const fetch = require('node-fetch').default || require('node-fetch');

async function fileProxy(req, res, next) {
  try {
    const targetUrl = req.targetUrl;
    
    const headers = {};
    
    const keepHeaders = ['accept', 'accept-language', 'cache-control', 'range'];
    for (const key of keepHeaders) {
      const value = req.get(key);
      if (value) {
        headers[key] = value;
      }
    }
    
    const targetHost = new URL(targetUrl).host;
    headers['host'] = targetHost;
    
    if (!headers['user-agent']) {
      headers['user-agent'] = 'Mozilla/5.0 (compatible; GitHub-Proxy/1.0)';
    }
    
    const removeHeaders = ['cf-ray', 'cf-connecting-ip', 'cf-visitor', 'x-forwarded-for', 'x-forwarded-proto'];
    removeHeaders.forEach(header => delete headers[header]);
    
    console.log('文件代理请求:', req.method, targetUrl);
    
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: headers,
      redirect: 'follow'
    });
    
    console.log('GitHub文件响应:', response.status, response.headers.get('content-type'));
    
    const responseHeaders = {};
    
    const keepResponseHeaders = [
      'content-type', 'content-length', 'content-disposition',
      'cache-control', 'expires', 'last-modified', 'etag', 'accept-ranges'
    ];
    
    for (const key of keepResponseHeaders) {
      const value = response.headers.get(key);
      if (value) {
        responseHeaders[key] = value;
      }
    }
    
    responseHeaders['access-control-allow-origin'] = '*';
    responseHeaders['access-control-allow-methods'] = 'GET, HEAD, OPTIONS';
    responseHeaders['access-control-allow-headers'] = 'Range, Accept, Accept-Encoding';
    responseHeaders['access-control-expose-headers'] = 'Content-Length, Content-Range, Accept-Ranges';
    responseHeaders['x-github-proxy'] = 'Express-File';
    
    res.status(response.status);
    res.set(responseHeaders);
    
    if (response.body) {
      response.body.pipe(res);
    } else {
      res.end();
    }
    
  } catch (error) {
    console.error('文件代理失败:', error);
    next(error);
  }
}

module.exports = fileProxy;