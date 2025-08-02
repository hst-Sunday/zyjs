function getHomePage() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Universal Proxy Service - GitHub & Docker - Express.js v5</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; background: #f8fafc; }
        .container { background: white; padding: 30px; border-radius: 12px; margin: 20px 0; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .success { background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 8px; margin: 15px 0; }
        .docker-section { background: #e8f4fd; border: 1px solid #bee5eb; padding: 15px; border-radius: 8px; margin: 15px 0; }
        .github-section { background: #e8f5e8; border: 1px solid #c3e6cb; padding: 15px; border-radius: 8px; margin: 15px 0; }
        code { background: #f1f3f4; padding: 4px 8px; border-radius: 4px; font-family: 'Monaco', monospace; font-size: 0.9em; }
        .example { background: #f8f9fa; border-left: 4px solid #007bff; padding: 15px 20px; border-radius: 4px; margin: 15px 0; }
        .github-example { background: #e8f5e8; border-left: 4px solid #28a745; padding: 15px 20px; border-radius: 4px; margin: 15px 0; }
        .docker-example { background: #e8f4fd; border-left: 4px solid #007bff; padding: 15px 20px; border-radius: 4px; margin: 15px 0; }
        h1 { color: #2c3e50; text-align: center; } h2 { color: #34495e; }
        .status { text-align: center; padding: 20px; background: #d1ecf1; border: 1px solid #bee5eb; border-radius: 8px; }
        .service-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0; }
        @media (max-width: 768px) { .service-grid { grid-template-columns: 1fr; } }
    </style>
</head>
<body>
    <h1>🚀 Universal Proxy Service (Express.js v5 + ofetch)</h1>
    
    <div class="status">
        <h3>✅ Dual-Service Proxy Server</h3>
        <p>🐙 GitHub Proxy | 🐳 Docker Registry Proxy | ⚡ Enhanced with ofetch</p>
    </div>
    
    <div class="container">
        <div class="success">
            <strong>🚀 Core Features:</strong>
            <ul>
                <li>✅ GitHub Git Smart HTTP Protocol + File Downloads</li>
                <li>✅ Docker Registry API v2 with Multi-Registry Support</li>
                <li>✅ Automatic Bearer Token Authentication</li>
                <li>✅ Intelligent Request Routing</li>
                <li>✅ Stream Processing for Large Files/Blobs</li>
                <li>✅ CORS Support + Auto Retry with ofetch</li>
            </ul>
        </div>
    </div>

    <div class="service-grid">
        <div class="container github-section">
            <h2>🐙 GitHub Proxy Service</h2>
            
            <h3>📖 Git Clone Usage</h3>
            <div class="github-example">
                <code>git clone http://localhost:3000/https://github.com/user/repo.git</code>
            </div>
            
            <h3>📁 File Download Usage</h3>
            <div class="github-example">
                <code># Raw files<br/>http://localhost:3000/https://raw.githubusercontent.com/user/repo/main/file.txt<br/><br/># Releases<br/>http://localhost:3000/https://github.com/user/repo/releases/download/v1.0/file.zip</code>
            </div>
            
            <h3>⚙️ Global Git Configuration</h3>
            <div class="github-example">
                <code>git config --global url."http://localhost:3000/https://github.com".insteadOf "https://github.com"</code>
            </div>
            
            <h3>🔍 Supported GitHub Domains</h3>
            <ul>
                <li><strong>github.com</strong> - Main GitHub repository</li>
                <li><strong>raw.githubusercontent.com</strong> - Raw file content</li>
                <li><strong>gist.githubusercontent.com</strong> - Gist files</li>
                <li><strong>objects.githubusercontent.com</strong> - Git objects</li>
                <li><strong>codeload.github.com</strong> - Archive downloads</li>
            </ul>
        </div>

        <div class="container docker-section">
            <h2>🐳 Docker Registry Proxy</h2>
            
            <h3>📖 Basic Docker Usage</h3>
            <div class="docker-example">
                <code>docker pull localhost:3000/nginx:latest<br/>docker pull localhost:3000/ubuntu:22.04</code>
            </div>
            
            <h3>🌐 Multi-Registry Support</h3>
            <div class="docker-example">
                <code># GitHub Container Registry<br/>docker pull localhost:3000/ghcr.io/user/repo:tag<br/><br/># Quay.io<br/>docker pull localhost:3000/quay.io/user/repo:tag<br/><br/># Google Container Registry<br/>docker pull localhost:3000/gcr.io/project/image:tag</code>
            </div>
            
            <h3>⚙️ Docker Daemon Configuration</h3>
            <div class="docker-example">
                <code># Edit /etc/docker/daemon.json<br/>{<br/>  "registry-mirrors": ["http://localhost:3000"]<br/>}<br/><br/># Then restart Docker<br/>sudo systemctl restart docker</code>
            </div>
            
            <h3>🔍 Supported Registries</h3>
            <ul>
                <li><strong>Docker Hub</strong> - registry-1.docker.io (default)</li>
                <li><strong>GitHub Container Registry</strong> - ghcr.io</li>
                <li><strong>Quay.io</strong> - quay.io</li>
                <li><strong>Google Container Registry</strong> - gcr.io</li>
                <li><strong>Kubernetes Registry</strong> - k8s.gcr.io</li>
            </ul>
        </div>
    </div>
    
    <div class="container">
        <h2>🔧 Advanced Usage Examples</h2>
        
        <h3>GitHub Examples</h3>
        <div class="github-example">
            <code># Clone a repository<br/>git clone http://localhost:3000/https://github.com/microsoft/vscode.git<br/><br/># Download a specific file<br/>curl http://localhost:3000/https://raw.githubusercontent.com/microsoft/vscode/main/package.json<br/><br/># Download a release asset<br/>wget http://localhost:3000/https://github.com/git/git/releases/download/v2.42.0/git-2.42.0.tar.gz</code>
        </div>
        
        <h3>Docker Examples</h3>
        <div class="docker-example">
            <code># Pull official images<br/>docker pull localhost:3000/nginx:stable-perl<br/>docker pull localhost:3000/postgres:15-alpine<br/><br/># Pull from other registries<br/>docker pull localhost:3000/ghcr.io/actions/runner:latest<br/>docker pull localhost:3000/quay.io/prometheus/prometheus:latest</code>
        </div>
    </div>
    
    <div class="container">
        <h2>⚡ Technical Features</h2>
        <div class="success">
            <strong>🎯 Express.js v5 Enhancements:</strong>
            <ul>
                <li>✅ Native async error handling (no try/catch needed)</li>
                <li>✅ Enhanced routing with named wildcards</li>
                <li>✅ Improved security with updated dependencies</li>
                <li>✅ Better performance and memory management</li>
            </ul>
        </div>
        
        <div class="success">
            <strong>🚀 ofetch Integration Benefits:</strong>
            <ul>
                <li>✅ Automatic retry logic with exponential backoff</li>
                <li>✅ Built-in error handling with parsed responses</li>
                <li>✅ Stream processing for large files and Docker blobs</li>
                <li>✅ Request/response interceptors for advanced processing</li>
            </ul>
        </div>
    </div>
    
    <footer style="text-align: center; color: #6c757d; margin-top: 40px; padding-top: 20px; border-top: 1px solid #dee2e6;">
        <p>⚡ Express.js v5 + ofetch | Universal Proxy Service | GitHub + Docker</p>
        <p>🚀 Enhanced Performance | Auto Retry | Stream Processing | Multi-Registry</p>
    </footer>
</body>
</html>`;
}

module.exports = {
  getHomePage
};