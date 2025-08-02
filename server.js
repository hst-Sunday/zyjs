const express = require('express');
const { parseGitHubUrl, detectRequestType, createErrorResponse } = require('./utils/helpers');
const gitProxy = require('./middleware/gitProxy');
const fileProxy = require('./middleware/fileProxy');
const { getHomePage } = require('./utils/homepage');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.raw({ type: '*/*', limit: '50mb' }));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
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

app.all('*', async (req, res, next) => {
  
  try {
    const pathname = req.originalUrl.split('?')[0];
    const searchParams = req.originalUrl.includes('?') ? '?' + req.originalUrl.split('?')[1] : '';
    
    let targetUrl = parseGitHubUrl(pathname);
    if (!targetUrl) {
      return createErrorResponse(res, 400, '无效的GitHub URL');
    }
    
    const supportedDomains = ['github.com', 'raw.githubusercontent.com', 'gist.githubusercontent.com', 'objects.githubusercontent.com', 'codeload.github.com'];
    const targetHost = new URL(targetUrl).hostname;
    if (!supportedDomains.includes(targetHost)) {
      return createErrorResponse(res, 400, '仅支持GitHub相关域名的代理');
    }
    
    if (searchParams) {
      targetUrl += searchParams;
    }
    
    const requestType = detectRequestType(req, targetUrl);
    console.log('代理请求:', req.method, targetUrl, '类型:', requestType);
    
    req.targetUrl = targetUrl;
    req.requestType = requestType;
    
    if (requestType === 'git') {
      return gitProxy(req, res, next);
    } else {
      return fileProxy(req, res, next);
    }
    
  } catch (error) {
    console.error('代理请求失败:', error);
    return createErrorResponse(res, 500, `代理失败: ${error.message}`);
  }
});

app.use((error, req, res, next) => {
  console.error('Express error:', error);
  createErrorResponse(res, 500, `服务器错误: ${error.message}`);
});

app.listen(PORT, () => {
  console.log(`GitHub代理服务器运行在端口 ${PORT}`);
  console.log(`访问 http://localhost:${PORT} 查看使用说明`);
});

module.exports = app;