# GitHub & Docker 代理服务

基于 Express.js 5 构建的高性能代理服务，支持 GitHub 和 Docker 容器镜像代理功能。

## 📋 功能特性

### GitHub 代理
- **Git 智能 HTTP 协议代理** - 支持 `git clone`、`git push`、`git pull` 操作
- **文件下载代理** - 直接下载 GitHub 文件和发布资源
- **智能请求路由** - 自动检测并处理不同类型的请求

### Docker 代理  
- **容器镜像代理** - 支持 Docker Hub、GitHub Container Registry 等镜像仓库
- **认证处理** - 自动处理 Docker 注册表认证流程
- **多注册表支持** - 支持 `ghcr.io`、`quay.io`、`gcr.io`、`k8s.gcr.io` 等

### 支持的 GitHub 域名
- `github.com` - 仓库操作和发布下载
- `raw.githubusercontent.com` - 原始文件内容
- `gist.githubusercontent.com` - Gist 文件下载
- `objects.githubusercontent.com` - Git 对象和发布资源
- `codeload.github.com` - 归档下载

## 🚀 快速开始

### 本地运行

```bash
# 安装依赖
npm install

# 启动服务 (Express.js 5)
npm start

# 开发模式
npm run dev

# 语法检查
npm test
```

服务将在 `http://localhost:3000` 启动

### Docker 部署

```bash
# 构建镜像
docker build -t github-docker-proxy .

# 运行容器
docker run -p 7998:7998 github-docker-proxy
```

## 📖 使用方法

### GitHub 代理使用

#### Git 克隆
```bash
# 通过代理克隆仓库
git clone https://your_domain.com/https://github.com/owner/repo.git

# 或使用简化格式
git clone https://your_domain.com/owner/repo.git
```

#### 文件下载
```bash
# 下载原始文件
wget https://your_domain.com/https://raw.githubusercontent.com/owner/repo/branch/file.txt

# 下载发布资源
wget https://your_domain.com/https://github.com/owner/repo/releases/download/v1.0.0/asset.zip
```

### Docker 代理使用

#### 拉取镜像
```bash
# 设置代理地址
export DOCKER_PROXY=localhost:3000

# 拉取 Docker Hub 镜像
docker pull $DOCKER_PROXY/library/nginx:latest

# 拉取 GitHub 容器镜像
docker pull $DOCKER_PROXY/ghcr.io/owner/image:tag

# 拉取 Quay 镜像
docker pull $DOCKER_PROXY/quay.io/repository/image:tag
```

## 🏗️ 架构设计

### 核心组件

- **server-v5.js** - 主服务入口点，使用 Express.js 5
- **middleware/github-proxy.js** - GitHub 代理中间件
- **middleware/docker-proxy.js** - Docker 代理中间件
- **utils/github-utils.js** - GitHub 相关工具函数
- **utils/docker-utils.js** - Docker 相关工具函数
- **utils/docker-auth.js** - Docker 认证处理
- **utils/combined-homepage.js** - 主页生成器

### 请求流程

1. **请求接收** - Express.js 接收所有代理请求
2. **类型检测** - 智能判断 GitHub 或 Docker 请求
3. **路由分发** - 根据类型分发到对应中间件
4. **代理处理** - 构建代理请求并转发
5. **响应处理** - 处理上游响应并返回客户端

### Git 代理逻辑

**Git 操作识别** (路由到 Git 代理):
- User-Agent 包含 `git/` 或 `Git/`
- 查询参数包含 `service=git-upload-pack` 或 `service=git-receive-pack`
- 路径包含 `/info/refs`、`/git-upload-pack`、`/git-receive-pack`
- Content-Type 包含 `application/x-git`

**文件下载** (路由到文件代理):
- 请求到 `raw.githubusercontent.com`、`gist.githubusercontent.com` 等
- GitHub 发布下载路径 (`/releases/download/`)
- 所有其他不匹配 Git 模式的请求

## ⚙️ 配置选项

### 环境变量

- `PORT` - 服务端口 (默认: 3000)
- `NODE_ENV` - 运行环境

### Docker 配置

- **基础镜像**: `node:22-alpine`
- **工作目录**: `/app`
- **暴露端口**: `7998`
- **启动命令**: `node server-v5.js`

## 🛠️ 开发

### 项目结构

```
zyjs8/
├── server-v5.js                 # 主服务文件
├── package.json                 # 项目配置
├── Dockerfile                   # Docker 构建文件
├── middleware/                  # 中间件目录
│   ├── github-proxy.js         # GitHub 代理
│   └── docker-proxy.js         # Docker 代理
├── utils/                       # 工具函数
│   ├── github-utils.js         # GitHub 工具
│   ├── docker-utils.js         # Docker 工具
│   ├── docker-auth.js          # Docker 认证
│   └── combined-homepage.js    # 主页生成
└── edgeone-functions/           # EdgeOne 函数 (可选)
    └── edgeone-github-proxy.js
```

### 关键实现细节

#### 编码修复
文件下载代理特别排除压缩相关头信息以防止 `ERR_CONTENT_DECODING_FAILED` 错误：
- 从发送到 GitHub 的请求中移除 `accept-encoding`
- 从响应中剥离 `content-encoding`  
- 让代理服务自动处理压缩

#### 头信息管理
- **Git 代理**: 保留所有原始头信息以确保 Git Smart HTTP 兼容性
- **文件代理**: 选择性头信息转发，支持 CORS 和压缩处理
- **Docker 代理**: 处理认证头信息和注册表特定头信息

## 📝 许可证

GPL-3.0 License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request 来改进这个项目。

## 📞 支持

如有问题或建议，请创建 Issue 或联系维护者。