function parseGitHubUrl(pathname) {
  let cleanPath = pathname.replace(/^\/+/, '');
  
  const githubDomains = [
    'github.com',
    'raw.githubusercontent.com',
    'gist.githubusercontent.com',
    'objects.githubusercontent.com',
    'codeload.github.com'
  ];
  
  if (cleanPath.startsWith('https://')) {
    const url = new URL(cleanPath);
    if (githubDomains.includes(url.hostname)) {
      return cleanPath;
    }
  }
  
  for (const domain of githubDomains) {
    if (cleanPath.startsWith(domain + '/')) {
      return 'https://' + cleanPath;
    }
  }
  
  if (cleanPath.length > 0 && !cleanPath.startsWith('http')) {
    return 'https://github.com/' + cleanPath;
  }
  
  return null;
}

function detectRequestType(request, targetUrl) {
  const url = new URL(targetUrl);
  const userAgent = request.get('user-agent') || '';
  const contentType = request.get('content-type') || '';
  
  const originalUrl = new URL(request.protocol + '://' + request.get('host') + request.originalUrl);
  const hasGitService = originalUrl.searchParams.has('service');
  const isGitUserAgent = userAgent.includes('git/') || userAgent.includes('Git/');
  const isGitPath = targetUrl.includes('/info/refs') || targetUrl.includes('/git-upload-pack') || targetUrl.includes('/git-receive-pack');
  const isGitContentType = contentType.includes('application/x-git');
  
  if (hasGitService || isGitUserAgent || isGitPath || isGitContentType) {
    return 'git';
  }
  
  if (url.hostname === 'raw.githubusercontent.com' || 
      url.hostname === 'gist.githubusercontent.com' ||
      url.hostname === 'objects.githubusercontent.com' ||
      url.hostname === 'codeload.github.com') {
    return 'file';
  }
  
  if (url.hostname === 'github.com') {
    if (url.pathname.includes('/releases/download/')) {
      return 'file';
    }
    return 'git';
  }
  
  return 'file';
}

function createErrorResponse(res, status, message) {
  return res.status(status).json({ error: message });
}

module.exports = {
  parseGitHubUrl,
  detectRequestType,
  createErrorResponse
};