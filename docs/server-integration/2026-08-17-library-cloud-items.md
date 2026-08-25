# 资料库云端聚合接口联调说明

> 日期：2026-08-17
>
> 最近更新：2026-08-19
>
> 涉及仓库：`LobsterAI`、`lobsterai-server`
>
> 数据库兼容：MySQL 5.7
>
> 合同状态：云端列表与 lineage 为现有联调合同；本文新增的分享文件 owner analytics 为待实现合同，服务端上线后客户端才开放入口

## 范围与数据边界

资料库由客户端聚合两类数据：

- 本地产物由 Electron 主进程读取本机文件和本地 SQLite 索引，不上传文件路径、文件内容、缩略图、本地收藏或完整会话关系；
- 分享文件和部署站点由服务端已有 `html_shares`、`share_deployments` 数据提供；
- 收藏全部保存在客户端 SQLite，服务端不新增收藏表或收藏接口；
- 服务端不新增本地产物主表，也不判断本地文件是否存在。

本期服务端已有云端列表只读聚合接口，并补齐现有分享更新接口对最新 `sessionId/artifactId` 的持久化；下一步新增分享文件 owner analytics 只读接口。分析复用 V52 已有访问统计表与采集链路，没有数据库 DDL 变更。

## 发布顺序

1. 先发布包含云端列表、分享 owner analytics 接口和 lineage 修复的 `lobsterai-server`；
2. 在测试环境使用个人账号和企业账号分别校验 owner 隔离、游标、站点状态和分享分析口径；
3. 发布带资料库入口的 Electron 客户端；
4. 旧客户端继续使用现有分享与站点接口，不受影响；
5. 分享分析入口通过客户端功能开关在 owner analytics 上线后开放；接口 404/`FEATURE_UNAVAILABLE` 时只隐藏分析入口，不回退调用 Admin 接口；
6. 新客户端连接尚未升级的服务端时，本地产物仍可使用，云端区域显示来源级错误和重试入口。

## 鉴权与账号归属

客户端主进程使用现有发布请求上下文携带 Bearer JWT，Renderer 不读取或持久化 JWT。服务端通过 `PublishingAccountContextResolver` 解析：

- `userId`；
- `accountMode`；
- 企业模式下的 `enterpriseId`。

接口不接受客户端传入用户 ID、账号模式或企业 ID。个人资料和企业资料严格按当前发布账号隔离。

## 云端资料列表

### 请求

```http
GET /api/library/cloud-items?kind=all&category=all&sharedStatus=all&keyword=&cursor=&pageSize=24
Authorization: Bearer <token>
```

| 参数 | 必填 | 默认值 | 约束 |
| --- | --- | --- | --- |
| `kind` | 否 | `all` | `all \| shared_file \| deployed_site` |
| `category` | 否 | `all` | `all \| web \| slides \| document \| spreadsheet \| image \| media \| other` |
| `sharedStatus` | 否 | `all` | `all \| live \| disabled`；非 `all` 时只允许与 `kind=shared_file` 一起使用 |
| `keyword` | 否 | 空 | 去除首尾空白后最多 100 个 Unicode code point；匹配标题、入口文件名和资源 ID |
| `cursor` | 否 | 空 | 服务端返回的不透明 Base64URL 游标，最长 2048 字符 |
| `pageSize` | 否 | `24` | 小于等于 0 时回退默认值，最大 100 |

统一响应外层：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "list": [],
    "nextCursor": null,
    "hasMore": false,
    "counts": {
      "sharedFile": 0,
      "deployedSite": 0
    },
    "sharedStatusCounts": {
      "all": 0,
      "live": 0,
      "disabled": 0
    }
  }
}
```

`counts` 应用当前 `category` 和 `keyword`，但不应用 `kind`，用于同一查询条件下展示“分享文件/部署站点”来源数量。

`sharedStatusCounts` 同样应用当前 `category` 和 `keyword`，但不应用当前 `sharedStatus`，用于分享文件页的“全部/已打开/已关闭”筛选数量。列表筛选和两组计数均由服务端 SQL 完成，客户端不能用当前页数据推导全量数量。

### 普通分享项

```json
{
  "itemKind": "shared_file",
  "itemId": "share-id",
  "title": "产品方案.pdf",
  "url": "https://example/share-id",
  "category": "document",
  "sourceType": "document_file",
  "entryFile": "产品方案.pdf",
  "accessMode": "public",
  "status": "live",
  "disabledSource": null,
  "moderationStatus": "approved",
  "totalFiles": 1,
  "totalBytes": 102400,
  "sessionId": "local-session-id",
  "artifactId": "session-artifact-id",
  "clientSourceKey": "sha256-key",
  "createdAt": "2026-08-17T10:00:00",
  "updatedAt": "2026-08-17T10:10:00",
  "contentUpdatedAt": "2026-08-17T10:10:00",
  "sortTime": 1786932600000
}
```

普通分享只包含以下来源，和部署站点互斥：

```text
html_file
image_file
svg_file
document_file
markdown_file
mermaid_file
```

普通分享列表只返回 `live` 和 `disabled` 两种可管理状态；`failed`、`deleted` 不进入资料库分享文件页。`disabledSource` 可能为 `user \| admin \| moderation \| active_limit \| system`，客户端据此判断是否允许重新打开。分享没有过期状态或过期时间字段。

### 部署站点项

```json
{
  "itemKind": "deployed_site",
  "itemId": "share-id",
  "title": "产品官网",
  "url": "https://example-site",
  "category": "web",
  "sourceType": "static_service_deployment",
  "entryFile": "index.html",
  "accessMode": "public",
  "status": "live",
  "shareStatus": "live",
  "siteKind": "static_site",
  "siteStatus": "online",
  "deploymentId": "deployment-id",
  "deploymentStatus": "live",
  "sessionId": "local-session-id",
  "artifactId": "session-artifact-id",
  "clientSourceKey": "sha256-key",
  "createdAt": "2026-08-17T10:00:00",
  "updatedAt": "2026-08-17T10:10:00",
  "sortTime": 1786932600000
}
```

站点状态计算复用 `SiteMapper.siteStatusExpression`，必须与现有 `/api/sites` 列表保持一致。每个 `shareId` 只选择一条最新部署记录，优先级为 `active DESC, created_at DESC, id DESC`。

### 排序和游标

服务端稳定排序为：

```text
sort_at DESC, item_kind DESC, item_id DESC
```

游标编码并校验相同三个字段：

```json
{
  "sortTime": 1786932600000,
  "itemKind": "shared_file",
  "itemId": "share-id"
}
```

客户端必须把 `cursor` 当作不透明字符串，不自行构造。SQL 使用派生表、`UNION ALL`、相关子查询和显式比较谓词，不使用 CTE、窗口函数、`JSON_TABLE` 或 MySQL 8 专属语法。

## 分享更新 lineage

现有接口保持路径和 multipart 语义不变，仅增加两个可选字段：

```http
PUT /api/html-shares/{shareId}
Content-Type: multipart/form-data

sessionId=<current local session id>
artifactId=<current session artifact id>
title=...
entryFile=...
accessMode=...
sourceSha256=...
clientSourceKey=...
archive=<file>
```

兼容规则：

- 新客户端传入非空 `sessionId/artifactId` 时覆盖为本次发布来源；
- 参数缺失、空字符串或只有空白时保留数据库原值；
- 旧客户端无需修改，不能因缺少新字段把原 lineage 清空；
- 服务端分别按 128 字符上限规范化两个字段；
- 本地会话删除不会通知服务端，客户端展示云端项时只在本机会话仍存在时建立跳转，否则按云端资料展示。

## 分享文件访问分析

### 接口状态与用途

以下为待实现、需要在客户端分析入口开放前冻结的 owner 合同。现有 `AdminHtmlShareController` 统计接口只供后台审核，不允许客户端直接调用；owner 响应不得包含脱敏 IP、User-Agent、Referer 或来源维度。

```http
GET /api/html-shares/{shareId}/analytics?from=2026-08-13&to=2026-08-19
Authorization: Bearer <token>
```

服务端使用 `PublishingAccountContextResolver` 解析当前个人/企业发布账号，并校验该账号拥有 `shareId`。接口只接受云端列表定义的普通分享来源；当前 owner 传入部署来源时返回 `INVALID_PARAMETER`，部署站点继续调用现有：

```http
GET /api/sites/{shareId}/analytics
```

### 日期参数

| 参数 | 必填 | 约束 |
| --- | --- | --- |
| `from` | 否 | `yyyy-MM-dd`；与 `to` 同时省略时默认为过去 7 个自然日（含今天） |
| `to` | 否 | `yyyy-MM-dd`；以服务端统计时区的今天为上限 |

以下情况复用 `INVALID_PARAMETER`：只传单侧日期、日期格式错误、`from > to`、`to` 晚于今天或范围包含超过 31 个自然日。服务端不接受客户端传时区；响应 `meta.timeZone` 返回实际统计时区。

### 响应

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "summary": {
      "accesses": 128,
      "uniqueVisitors": 46
    },
    "trend": [
      {
        "date": "2026-08-13",
        "accesses": 20,
        "uniqueVisitors": 8
      },
      {
        "date": "2026-08-14",
        "accesses": 0,
        "uniqueVisitors": 0
      }
    ],
    "meta": {
      "from": "2026-08-13",
      "to": "2026-08-19",
      "granularity": "day",
      "timeZone": "Asia/Shanghai",
      "dataScope": "share_lifetime",
      "visitorMetric": "ip_hash_estimate",
      "retentionDays": 180,
      "dataAvailableFrom": "2026-06-01"
    }
  }
}
```

合同约束：

- `trend` 按日期升序覆盖请求范围的每一天，缺失日期由 Service 补 0；
- `summary.accesses` 为范围内所有有效入口文件请求总数；
- `summary.uniqueVisitors` 在整个范围内对 `ip_hash` 去重，同一访客跨天只计一次，不能用每日独立访客相加；
- `trend[].uniqueVisitors` 是各自然日内的去重值；
- `retentionDays/timeZone` 读取当前服务端配置，客户端不硬编码；
- `dataAvailableFrom` 为该分享当前保留数据的最早日期，无数据时允许为 `null`；
- 无数据是成功响应，摘要和完整趋势均为 0；分享为 `disabled` 时仍可读取停用前历史。

### 统计口径

当前 V52 采集链路记录通过访问校验后的入口文件请求：

- 计入：公开访问或分享码校验成功后的入口文件请求；
- 不计入：分享码输入页、被拒绝/失败的请求、静态依赖资源、管理员预览；
- 所有者通过普通公共链接访问按普通访客计数；通过管理端预览不计数；
- 当前链路不能可靠区分浏览、预览与下载，所以 UI 和 API 使用 `accesses/访问次数`，不命名为下载量或页面浏览量；
- 独立访客是 HMAC 后 IP 的估算值，同网出口、代理和 IP 变化会影响精度。

分析数据按稳定 `shareId` 覆盖整个分享生命周期。文件更新可能生成新的 `source_sha256/content_updated_at`，owner analytics 必须汇总全部内容版本；现有后台 `getAccessTrend()` 绑定当前版本，不能直接复用，否则更新内容后历史会归零。

### MySQL 5.7 查询

不新增表或列，复用：

- `html_share_access_stats`；
- `html_share_ip_access_stats`；
- `html_share_access_dimension_stats`（首期 owner 接口不读取）。

Mapper 增加跨内容版本查询：

```sql
SELECT stat_date,
       SUM(total_access_count) AS accesses
FROM html_share_access_stats
WHERE share_id = #{shareId}
  AND stat_date BETWEEN #{from} AND #{to}
GROUP BY stat_date
ORDER BY stat_date ASC;

SELECT stat_date,
       COUNT(DISTINCT ip_hash) AS unique_visitors
FROM html_share_ip_access_stats
WHERE share_id = #{shareId}
  AND stat_date BETWEEN #{from} AND #{to}
GROUP BY stat_date
ORDER BY stat_date ASC;

SELECT COUNT(DISTINCT ip_hash) AS unique_visitors
FROM html_share_ip_access_stats
WHERE share_id = #{shareId}
  AND stat_date BETWEEN #{from} AND #{to};
```

访问次数范围合计可在 Service 层使用 `long` 汇总第一条查询结果。日期补零在 Java 完成，不使用递归 CTE、窗口函数或 MySQL 8 专属语法。现有 `idx_html_share_access_share_date (share_id, stat_date)` 与 `idx_html_share_ip_access_top (share_id, stat_date, access_count)` 先作为范围过滤索引；`COUNT(DISTINCT ip_hash)` 必须在 MySQL 5.7 测试库执行 `EXPLAIN` 和 7/30 天量级压测，只有数据证明必要时再单独评审覆盖索引或预聚合。

### 客户端对接

1. `HtmlShareIpc` 增加集中定义的 `GetAnalytics = htmlShare:getAnalytics`；
2. Main 校验 `shareId/from/to` 后，由 `htmlShareClient` 携带现有发布鉴权请求服务端；
3. Preload 只暴露 analytics 所需最小方法和共享响应类型；
4. Renderer 使用 `ownerScope + shareId + from + to` 作为 queryKey，忽略迟到响应；
5. 分析页默认 7 天，可切换 30 天，只显示独立访客、访问次数和趋势，不显示热门页面；
6. 分析请求失败局部重试，不清空设置详情或云端列表。

## 错误和降级

- 未登录或鉴权失效：沿用现有统一鉴权响应；客户端只禁用云端来源，本地产物继续可用；
- 非法 `kind/category/sharedStatus/cursor`，或把非 `all` 的 `sharedStatus` 与非 `shared_file` 的 `kind` 组合：返回现有 `INVALID_PARAMETER`；
- 云端网络错误或 5xx：客户端显示云端来源级错误和重试，不清空本地产物；
- 单条服务端数据字段异常：客户端丢弃该条记录，不影响其他资料；
- `media` 分类首期可以为空，不代表支持尚未发布的音频分享格式。
- 分享分析日期非法：`INVALID_PARAMETER`；客户端保留当前分析数据并恢复到最后有效范围；
- 分享分析没有历史数据或统计采集未启用：成功返回全 0 和真实 `meta`，不返回 5xx；
- 分享分析资源不属于当前账号、已删除或切换账号：沿用 owner 详情不可见语义，客户端返回云端列表并清理该资源缓存；
- 分享分析网络/5xx：只影响分析区，分享设置、本地产物和其他云端资源继续可用。

## 数据库与上线核对

本期不执行迁移 SQL，也不新增索引。上线前应在 MySQL 5.7 测试库完成：

1. 个人、企业账号各准备普通分享和两种部署站点；
2. 校验普通分享与站点互斥、已删除记录不可见；
3. 校验相同 `sort_at` 下翻页不重不漏；
4. 校验 `share_id` mixed collation 连接与现有 Sites 查询一致；
5. 使用 `EXPLAIN` 观察 owner/source 条件和最新 deployment 子查询；
6. 为同一分享准备多个内容版本和跨天重复 IP，校验访问总数跨版本求和、范围独立访客跨天/跨版本去重；
7. 使用 `EXPLAIN` 观察 7/30 天分享分析查询，重点检查 `COUNT(DISTINCT ip_hash)` 的扫描行数、临时表和延迟；
8. 校验 disabled 分享可读历史、站点来源拒绝、owner 响应不包含 IP/UA/Referer；
9. 只有在真实数据量证明必要时另行评审索引，不能在本功能中直接增加未经验证的生产索引。

服务端自动化测试因部分测试依赖 Redis 和外部发布服务，本次按约定不执行完整测试套件；至少需要使用 JDK 17 完成 `compileJava`，并校验 Mapper XML 语法。
