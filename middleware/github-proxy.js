const { ofetch } = require('ofetch');
const {
  parseGitHubUrl,
  detectRequestType,
  buildGitProxyHeaders,
  buildFileProxyHeaders,
  buildGitProxyResponse,
  buildFileProxyResponse
} = require('../utils/github-utils');

async function githubProxy(req, res, next) {
  try {
    let pathname = req.params.path || '';
    if (Array.isArray(pathname)) {
      pathname = pathname.join('/');
    }
    pathname = '/' + pathname;
    const searchParams = req.originalUrl.includes('?') ? '?' + req.originalUrl.split('?')[1] : '';
    
    let targetUrl = parseGitHubUrl(pathname);
    if (!targetUrl) {
      return res.status(400).json({ error: '无效的GitHub URL' });
    }
    
    const supportedDomains = ['github.com', 'raw.githubusercontent.com', 'gist.githubusercontent.com', 'objects.githubusercontent.com', 'codeload.github.com'];
    const targetHost = new URL(targetUrl).hostname;
    if (!supportedDomains.includes(targetHost)) {
      return res.status(400).json({ error: '仅支持GitHub相关域名的代理' });
    }
    
    if (searchParams) {
      targetUrl += searchParams;
    }
    
    const requestType = detectRequestType(req, targetUrl);
    console.log('GitHub代理请求:', req.method, targetUrl, '类型:', requestType);
    
    if (requestType === 'git') {
      return await handleGitProxy(req, res, targetUrl);
    } else {
      return await handleFileProxy(req, res, targetUrl);
    }
    
  } catch (error) {
    console.error('GitHub代理失败:', error);
    next(error);
  }
}

async function handleGitProxy(req, res, targetUrl) {
  const headers = buildGitProxyHeaders(req, targetUrl);
  
  const requestConfig = {
    method: req.method,
    headers: headers,
    retry: 3,
    retryStatusCodes: [429, 500, 502, 503, 504],
    timeout: 120000
  };
  
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    requestConfig.body = req.body;
  }
  
  console.log('Git代理请求:', req.method, targetUrl);
  
  try {
    const response = await ofetch.raw(targetUrl, requestConfig);
    
    console.log('GitHub Git响应:', response.status, response.headers.get('content-type'), 'Content-Length:', response.headers.get('content-length'));
    
    const responseHeaders = buildGitProxyResponse(response);
    
    res.status(response.status);
    res.set(responseHeaders);
    
    // 对于 Git Smart HTTP 协议，需要特殊处理流式数据
    if (response._data) {
      // ofetch 已经读取了数据，需要正确处理不同类型
      console.log('响应数据类型:', typeof response._data, response._data.constructor.name);
      
      if (Buffer.isBuffer(response._data)) {
        res.end(response._data);
      } else if (typeof response._data === 'string') {
        res.end(response._data, 'utf8');
      } else if (response._data instanceof Blob) {
        // 处理 Blob 类型
        const arrayBuffer = await response._data.arrayBuffer();
        res.end(Buffer.from(arrayBuffer));
      } else if (response._data instanceof ArrayBuffer) {
        // 处理 ArrayBuffer 类型
        res.end(Buffer.from(response._data));
      } else if (response._data instanceof Uint8Array) {
        // 处理 Uint8Array 类型
        res.end(Buffer.from(response._data));
      } else {
        // 其他类型，尝试转换
        console.warn('未知的响应数据类型，尝试转换:', typeof response._data);
        try {
          const arrayBuffer = await response._data.arrayBuffer();
          res.end(Buffer.from(arrayBuffer));
        } catch (conversionError) {
          console.error('数据类型转换失败:', conversionError);
          res.status(500).json({ error: '响应数据处理失败' });
          return;
        }
      }
    } else if (response.body) {
      // 流式处理
      const reader = response.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
        res.end();
      } catch (streamError) {
        console.error('Git流式传输错误:', streamError);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Git流式传输失败' });
        }
      } finally {
        reader.releaseLock();
      }
    } else {
      res.end();
    }
  } catch (gitError) {
    console.error('Git代理错误:', gitError);
    console.error('错误堆栈:', gitError.stack);
    if (!res.headersSent) {
      if (gitError.code === 'ERR_INVALID_ARG_TYPE') {
        res.status(500).json({ error: '响应数据类型处理错误，请检查服务器日志' });
      } else {
        res.status(500).json({ error: `Git代理失败: ${gitError.message}` });
      }
    }
  }
}

async function handleFileProxy(req, res, targetUrl) {
  const headers = buildFileProxyHeaders(req, targetUrl);
  
  const requestConfig = {
    method: req.method,
    headers: headers,
    retry: 3,
    retryStatusCodes: [429, 500, 502, 503, 504],
    timeout: 90000
  };
  
  console.log('文件代理请求:', req.method, targetUrl);
  
  const response = await ofetch.raw(targetUrl, requestConfig);
  
  console.log('GitHub文件响应:', response.status, response.headers.get('content-type'));
  
  const responseHeaders = buildFileProxyResponse(response);
  
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

module.exports = githubProxy;