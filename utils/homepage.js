function getHomePage() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GitHub 代理服务 - Git Clone & 文件下载 - Express.js</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; background: #f8fafc; }
        .container { background: white; padding: 30px; border-radius: 12px; margin: 20px 0; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .success { background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 8px; margin: 15px 0; }
        code { background: #f1f3f4; padding: 4px 8px; border-radius: 4px; font-family: 'Monaco', monospace; font-size: 0.9em; }
        .example { background: #e8f5e8; border-left: 4px solid #28a745; padding: 15px 20px; border-radius: 4px; margin: 15px 0; }
        h1 { color: #2c3e50; text-align: center; } h2 { color: #34495e; }
        .status { text-align: center; padding: 20px; background: #d1ecf1; border: 1px solid #bee5eb; border-radius: 8px; }
    </style>
</head>
<body>
    <h1>🚀 GitHub 代理服务 (Express.js v1.0.0)</h1>
    
    <div class="status">
        <h3>✅ 多功能 GitHub 代理服务</h3>
        <p>Git Clone | Raw 文件下载 | Releases 下载 | Gist 下载</p>
    </div>
    
    <div class="container">
        <div class="success">
            <strong>🚀 功能特性：</strong>
            <ul>
                <li>✅ Git Smart HTTP 协议完整实现</li>
                <li>✅ GitHub Raw 文件直接下载</li>
                <li>✅ GitHub Releases 文件下载</li>
                <li>✅ GitHub Gist 文件下载</li>
                <li>✅ 智能请求类型检测</li>
                <li>✅ 跨域访问支持（CORS）</li>
            </ul>
        </div>
        
        <h2>📖 Git Clone 使用方法</h2>
        <p><strong>基本语法：</strong></p>
        <div class="example">
            <code>git clone http://localhost:3000/https://github.com/用户名/仓库名.git</code>
        </div>
        
        <p><strong>实际示例：</strong></p>
        <div class="example">
            <code>git clone http://localhost:3000/https://github.com/microsoft/vscode.git</code>
        </div>
    </div>
    
    <div class="container">
        <h2>📁 文件下载功能</h2>
        
        <p><strong>GitHub Raw 文件下载：</strong></p>
        <div class="example">
            <code>http://localhost:3000/https://raw.githubusercontent.com/用户名/仓库名/分支名/文件路径</code>
        </div>
        
        <p><strong>GitHub Releases 文件下载：</strong></p>
        <div class="example">
            <code>http://localhost:3000/https://github.com/用户名/仓库名/releases/download/版本号/文件名</code>
        </div>
        
        <p><strong>GitHub Gist 文件下载：</strong></p>
        <div class="example">
            <code>http://localhost:3000/https://gist.githubusercontent.com/用户名/gist-id/raw/文件名</code>
        </div>
        
        <p><strong>实际示例：</strong></p>
        <div class="example">
            <code># Raw文件<br/>http://localhost:3000/https://raw.githubusercontent.com/cmliu/CF-Workers-GitHub/refs/heads/main/_worker.js</code><br/><br/>
            <code># Release文件<br/>http://localhost:3000/https://github.com/git/git/releases/download/v2.42.0/git-2.42.0.tar.gz</code><br/><br/>
            <code># Gist文件<br/>http://localhost:3000/https://gist.githubusercontent.com/username/abc123/raw/script.js</code>
        </div>
    </div>
    
    <div class="container">
        <h2>🛠️ 高级配置</h2>
        
        <p><strong>全局Git配置（推荐）：</strong></p>
        <div class="example">
            <code>git config --global url."http://localhost:3000/https://github.com".insteadOf "https://github.com"</code>
        </div>
        
        <p><strong>验证配置：</strong></p>
        <div class="example">
            <code>git config --global --get-regexp url</code>
        </div>
        
        <p><strong>取消配置：</strong></p>
        <div class="example">
            <code>git config --global --unset url."http://localhost:3000/https://github.com".insteadOf</code>
        </div>
    </div>
    
    <footer style="text-align: center; color: #6c757d; margin-top: 40px; padding-top: 20px; border-top: 1px solid #dee2e6;">
        <p>⚡ Express.js | 多功能 GitHub 代理 | 本地开发服务器</p>
        <p>🚀 增强版本 - Git Clone + 文件下载 + 智能路由</p>
    </footer>
</body>
</html>`;
}

module.exports = {
  getHomePage
};