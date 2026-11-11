# 纸间营造小程序后台

纸间营造 · 大曾的独立后端仓库，提供工作室介绍、作品和研究内容 API。关联小程序 AppID：`wx2c0052de7361c89e`。

技术栈为 Node.js、Express、MySQL。仓库包含后端、Dockerfile、运行所需的初始内容和内置图片。当前提供内容管理接口，尚无可视化管理页面。

## 本地运行

需要 Node.js **22.12 或以上**，推荐 Node.js 22 LTS 或 24 LTS。

```sh
npm ci
cp .env.example .env
npm start
```

默认监听 `0.0.0.0:8080`。本地未配置 MySQL 时，内容保存在 `server/data/content.json`，该目录不提交到 Git。

```sh
curl http://127.0.0.1:8080/healthz
curl -i http://127.0.0.1:8080/api/content
npm test
```

## 微信云托管部署

在云托管中关联此仓库的 `main` 分支，从仓库根目录使用 `Dockerfile` 构建。服务端口设为 **8080**，健康检查路径设为 **`/healthz`**。

```sh
docker build -t zhijian-api .
```

镜像默认 `NODE_ENV=production`。在云托管控制台设置以下后端环境变量：

| 变量 | 说明 |
| --- | --- |
| `MYSQL_HOST` | `10.23.101.57`，须与云托管服务网络互通 |
| `MYSQL_PORT` | `3306` |
| `MYSQL_USER` | 当前配置为 `root` |
| `MYSQL_PASSWORD` | 数据库密码 |
| `MYSQL_DATABASE` | `nodejs_demo` |
| `ADMIN_TOKEN` | 至少 32 字符的随机管理令牌 |
| `ALLOWED_ORIGIN` | 可选，独立 H5 客户端的精确来源 |

完整生产模板见 `.env.production.example`。不要上传填写了密码的 `.env` 或 `.env.production`。`npm start` 只自动读取本地 `.env`；云托管直接使用控制台注入的环境变量。

### GitHub 安全配置与检查

仓库的 **Settings → Secrets and variables → Actions** 保存以下配置：

- Secrets：`MYSQL_PASSWORD`、`ADMIN_TOKEN`。
- Variables：`MYSQL_HOST`、`MYSQL_PORT`、`MYSQL_USER`、`MYSQL_DATABASE`、`MYSQL_EXTERNAL_HOST`、`MYSQL_EXTERNAL_PORT`。

内网变量用于记录生产连接配置；外网变量用于 GitHub 托管运行器的只读连接检查。GitHub Secrets 不会自动注入微信云托管，也不会打包到镜像中；部署时必须在云托管控制台填写对应运行环境变量。

每次推送 `main` 或提交 PR，GitHub Actions 会运行后端测试并构建 Docker 镜像。可以在 **Actions → Backend checks → Run workflow** 勾选 `check_database`，验证数据库登录与只读查询；该检查不会建表或写入内容。

本地已填写数据库配置后，也可以运行：

```sh
npm run db:check
```

外网访问需允许执行检查的机器访问数据库；云托管服务使用内网地址需要网络互通。

生产环境必须配置 MySQL，禁止使用容器本地文件持久化。数据库账号需要在指定库创建、读取和更新 `portfolio_content` 表的权限。初次启动会插入演示内容，后续启动不会覆盖已有内容；正式内容请将 `isDemo` 改为 `false`。

`/healthz` 会读取内容存储，数据库不可用时返回 503。通过健康检查后，再在小程序前端配置云托管环境 ID 和服务名称，使用 `wx.cloud.callContainer` 访问 `/api/content`。

AppID 是公开标识。当前内容 API 不调用需要 AppSecret 或上传私钥的微信接口，因此代码无需嵌入这些凭证。微信 AppSecret、上传私钥、管理令牌和数据库密码均不得提交到仓库；未来需要微信服务端接口时，通过运行环境的密钥配置注入。

## API

| 方法及路径 | 用途 |
| --- | --- |
| `GET /healthz` | 存储健康检查 |
| `GET /api/content` | 公开读取内容，响应含 `ETag` |
| `PUT /api/content` | 管理员完整更新内容 |
| `GET /static/images/<文件名>` | 读取内置演示图片 |

更新内容时携带 `Authorization: Bearer <ADMIN_TOKEN>`、`Content-Type: application/json` 和 `If-Match: <上次读取的 ETag>`。鉴权失败返回 401，缺少版本返回 428，版本冲突返回 409，内容校验失败返回 400。

内容示例见 `src/data/content.js`，结构约束见 `server/schema.js`。媒体支持 HTTPS 链接或 `/static/images/文件名`。正式作品媒体建议使用对象存储的长期 HTTPS 链接；仓库中的作品、文案和照片为演示素材。

## 验证范围

`npm test` 覆盖内容读取、鉴权、校验、并发冲突、文件持久化，以及生产环境禁止本地文件存储。`npm run db:check` 验证真实 MySQL 登录及只读查询，不验证建表和写入权限。Docker 构建由 GitHub Actions 检查；云托管部署、内网连接及微信真机调用需要在对应环境进一步验证。上传源码不等同于完成服务部署或小程序发布。
