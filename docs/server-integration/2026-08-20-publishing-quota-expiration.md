# 分享与部署额度、过期联调说明

日期：2026-08-20

状态：额度、过期能力及“普通用户升级订阅后恢复限时资源”均已实现；2026-08-24 完成客户端与服务端联调合同更新。

## 涉及项目

- 客户端：`LobsterAI`
- 服务端：`lobsterai-server`
- `lobsterai-portal`、`lobsterai-admin`：本期不改

## 数据库变更

上线前执行服务端迁移：

```text
lobsterai-server/sql/V77__publishing_quota_expiration.sql
```

迁移只给 `html_shares` 增加可空字段 `access_expires_at DATETIME NULL`，兼容 MySQL 5.7，不增加外键。`NULL` 表示按订阅/团队权益判断；非空表示固定公开访问截止时间。

订阅升级自动恢复不新增迁移或数据库表。它直接复用：

- `html_shares.access_expires_at IS NOT NULL` 识别仍处于普通用户固定时限语义的资源；
- 现有分享状态、关闭来源/原因判断是否允许自动恢复；
- 现有 `share_deployments` 状态对静态网站自动恢复和 Node 服务用户主动重新部署做并发抢占；自动检查不得启动 Node 服务。

恢复成功后清空 `access_expires_at`，资源自然退出候选集合；这同时构成幂等标记。不得为本场景增加升级批次表、恢复任务表或已处理标志列。

## 服务端配置

| 配置 | 默认值 | 说明 |
| --- | ---: | --- |
| `html-share.free-total-shares-per-user` | 10 | 普通用户累计文件分享数 |
| `site.quota.free-total-limit` | 1 | 普通用户累计网站数 |
| `html-share.free-access-ttl-seconds` | 7200 | 普通用户新资源固定有效期 |
| `html-share.entitlement-loss-grace-days` | 7 | 订阅/团队身份失效后的访问宽限期 |
| `html-share.enterprise-active-share-limit` | 100 | 每企业、每成员的活跃文件数 |
| `site.quota.enterprise-default-limit` | 5 | 每企业、每成员的活跃网站数 |
| `html-share.plan-active-limits.*` | 100/200/500/1000 | 各个人订阅套餐活跃文件数 |
| `site.quota.plan-limits.*` | 5/15/40/100 | 各个人订阅套餐活跃网站数 |

配置启动时要求为正数。客户端不硬编码额度或 2 小时，只展示服务端返回值。

## API 变化

### 普通用户公共体验策略

```http
GET /api/publishing/trial-policy
```

该接口免登录，只返回服务端当前普通用户产品策略：

```json
{
  "identityType": "free",
  "file": {
    "resourceKind": "file",
    "countMode": "total",
    "limit": 10,
    "accessTtlSeconds": 7200,
    "canReleaseByClosing": false
  },
  "site": {
    "resourceKind": "site",
    "countMode": "total",
    "limit": 1,
    "accessTtlSeconds": 7200,
    "canReleaseByClosing": false
  }
}
```

未登录分享/部署弹窗每次打开时读取对应资源的 `limit`，主操作“去登录”。接口读取失败时显示不带固定数字的降级文案，客户端不得回退到硬编码 10/1/2 小时。

### 文件分享额度预检

```http
GET /api/html-shares/quota
Authorization: Bearer <token>
```

响应 `data`：

```json
{
  "allowed": false,
  "identityType": "free",
  "resourceKind": "file",
  "countMode": "total",
  "planName": "free",
  "planDisplayName": "普通用户",
  "used": 10,
  "limit": 10,
  "remaining": 0,
  "canReleaseByClosing": false
}
```

预检只用于减少无效上传；创建接口仍在同一用户额度锁下做最终校验。

### 网站额度

既有网站 quota 响应新增：

```text
identityType: free | subscription | enterprise
resourceKind: site
countMode: total | active
canReleaseByClosing: boolean
```

普通用户按累计量统计，关闭、过期、删除均不释放；订阅和团队按活跃量统计。

### 额度错误

文件沿用 `HTML_SHARE_ACTIVE_LIMIT_EXCEEDED`，网站沿用 `SITE_ACTIVE_QUOTA_EXCEEDED`。错误响应 `data` 提供结构化额度快照：

```json
{
  "identityType": "subscription",
  "resourceKind": "file",
  "countMode": "active",
  "used": 100,
  "limit": 100,
  "canReleaseByClosing": true
}
```

Electron 主进程会保留该结构，渲染进程不得解析中文错误文案。普通用户命中总量额度后，弹窗使用响应中的 `limit`，主操作“去订阅”；订阅/团队命中活跃额度后，主操作“去处理”进入“我的文件 > 云端”。两种情况都不会自动关闭资源。

### 资源过期时间

- 分享创建、详情、状态与访问模式响应新增可选 `accessExpiresAt`。
- Library 云端列表的文件、网站条目新增可选 `accessExpiresAt`（Unix epoch 毫秒）。
- Library 云端列表条目新增只读有效状态投影：
  - `effectiveAvailable: boolean`；
  - `effectiveExpiresAt?: number`（Unix epoch 毫秒）；
  - `effectiveUnavailableReason?: share_not_live | site_not_online | free_access_expired | entitlement_grace_expired`。
- Library 云端列表顶层新增 `serverNow`（Unix epoch 毫秒）。
- Library 云端列表可选返回 `recoveryPending: boolean`；仅表示当前订阅账号仍有普通用户限时静态网站正在自动恢复或存在可立即自动处理的候选。已停止且等待用户重新部署的 Node 服务不计入 pending；旧客户端忽略该字段。
- 旧服务端不返回这些字段时，新客户端保持原展示且不猜测截止时间。

示例：订阅身份失效超过宽限期、但尚未发生公开访问关闭时，数据库原始 `status` 仍可能为 `live`，列表会返回：

```json
{
  "status": "live",
  "accessExpiresAt": null,
  "effectiveAvailable": false,
  "effectiveExpiresAt": 1787211120000,
  "effectiveUnavailableReason": "entitlement_grace_expired"
}
```

客户端状态、可访问筛选、打开链接按钮及云端详情操作必须使用 `effective*` 投影和 `serverNow`，不能仅使用数据库原始 `status`。`effectiveExpiresAt` 允许页面停留期间在宽限期边界自动切换为不可访问，无需轮询服务端。

普通用户分享与部署详情弹窗根据服务端返回的 `accessExpiresAt/expiresAt` 显示“限时体验”和实际剩余时间。到期后客户端立即显示“链接已过期”并禁用权限更新和文件更新；复制链接仍可保留，最终访问结果由服务端判断。若账号后来升级为有效订阅，已停止 Node 服务应显示“需要重新部署”并重新启用用户主动重新部署入口，但不能由列表检查自动提交部署。

客户端基于 `serverNow` 加单调时钟流逝量计算剩余时间，整个页面共用一个低频计时器；不轮询服务端、不逐行创建定时器。到期后立即在本地显示不可访问并禁用打开，最终权限仍由服务端校验。

## 服务端规则

### 普通登录用户

- 文件累计最多 10 个、网站累计最多 1 个（均可配置）。
- 创建时写入 `access_expires_at = created_at + TTL`；更新不延长。
- 截止时间到达后，公开访问和普通用户更新/重新开启失败。
- 过期仅在真实公开访问时条件关闭数据库状态；列表读取不写库。

### 订阅和团队用户

- 按活跃量统计，创建/重新开启时做并发安全的最终校验。
- 每次写操作和公开访问都只读查询当前订阅或团队身份，不把订阅有效期快照写进分享记录。
- 身份失效后，拥有者写操作立即拒绝；公开访问在失效时间起 7 天内仍可访问。
- 第 7 天后首次访问该具体链接时条件关闭该链接。只关闭本次访问的资源，不批量关闭该用户的其他资源。
- Library 云端列表对普通列表读取仍只计算 `effective*` 投影；唯一受控副作用是有效个人订阅用户请求无 cursor 的第一页时，可以触发下节所述的幂等升级恢复。筛选或搜索切换后产生的无 cursor 第一页同样会做快速候选检查，只有带 cursor 的续页不触发。
- 如果失效期间无人访问且用户已经恢复订阅/团队身份，旧链接继续有效。
- 一旦链接已因“订阅/团队权益失效宽限期结束”而关闭，恢复身份仍不会被本方案自动开启；该场景没有固定 `access_expires_at`，与普通用户限时体验升级严格分离。
- 网站公开访问被关闭后，异步停止对应运行资源；访问请求本身不等待清理任务。

### 普通用户升级订阅后的自动恢复（已实现）

#### 适用范围

仅处理个人普通用户阶段创建且 `access_expires_at IS NOT NULL` 的分享文件和网站。恢复服务执行前必须通过服务端订阅服务再次确认当前用户是有效个人订阅；不信任客户端传入的套餐或身份。

以下资源不自动恢复：

- 企业账号资源；
- 用户主动关闭、管理员关闭、审核拒绝、活跃额度关闭或未知关闭原因；
- `failed/deleted`；
- 订阅/团队权益失效宽限期结束后关闭的资源。

#### 触发顺序

两个入口复用同一 `PublishingSubscriptionRecoveryService` 幂等服务：

1. 订阅激活事务提交后异步触发；恢复失败不得回滚订阅或延长订阅接口耗时。
2. 有效个人订阅用户请求 `GET /api/library/cloud-items` 的无 cursor 第一页时自动兜底检查；这就是用户进入「我的文件 > 云端」、刷新或改变条件后重新请求第一页时的自动检查。带 cursor 的续页不检查。

当前单次事务最多锁定并处理 64 条候选。成功清空到期时间后不再命中，重复触发无需单独去重表。首期不增加定时扫描或后台补偿任务；若订阅事件处理失败，用户下一次请求云端第一页时自然重试。

#### 文件恢复

- 尚未到期且 `live`：清空 `access_expires_at`，其他字段不变。
- 到期但仍为 `live`：清空到期时间，随后按订阅权益正常访问。
- 仅因固定体验到期（`free access expired`）被系统关闭：用条件更新恢复 `live`、清理该到期原因并清空到期时间。
- URL、访问模式、分享码、内容版本、lineage、创建时间均保持不变。
- 条件更新必须同时校验非空到期标记、允许恢复的关闭原因和当前状态；并发的用户停止访问、管理员/审核动作优先。

#### 网站恢复

- Node 或静态运行资源仍在线：按文件规则转换分享记录即可，不重启运行资源。
- 已停止静态网站：静态内容仍由现有分享存储提供时，自动恢复服务使用现有 deployment 记录做条件更新，将 `stopped/expired` 恢复为 `live`，同时恢复分享状态并清空两侧到期时间；不创建新运行资源。
- 已停止 Node 服务：自动检查只投影为“不可访问 / 需要重新部署”，不清空到期时间、不进入自动队列、不调用部署平台；用户主动点击重新部署后才进入现有部署状态机。
- Node 用户主动重新部署成功后，服务端恢复分享状态并清空 `access_expires_at`；失败则保留不可访问、非空到期标记和可重试状态。
- 候选查询在 SQL 层排除已停止/已过期/需要重新部署的 `node_service_deployment`；它们不计入自动恢复执行数或 `recoveryPending`，到期标记只在用户重新部署成功后清除。
- 静态网站只有处于 `stopped/expired + active=0 + expires_at IS NOT NULL` 时才参与条件恢复；来源缺失、`failed/redeploy_required` 或其他状态继续保持不可访问，等待用户处理。
- 分享行先加写锁，deployment 使用带 owner、类型、状态和到期标记的条件更新；分享与 deployment 在同一事务提交，任一配对更新违反预期即整体回滚，不会出现一侧已恢复、另一侧仍过期。

#### 客户端刷新

- 客户端订阅/额度变更事件只清理当前发布账号的云端查询缓存并重拉，不乐观改状态。
- 第一页响应为 `recoveryPending=true` 时，客户端最多在 3 秒、10 秒和 30 秒各重拉一次；页面离开、账号切换、恢复完成或次数用尽即停止。
- 重拉按稳定资源 ID 原位合并，保留类型、状态、关键词、收藏筛选和滚动位置。
- 资源是否可访问始终使用服务端 `effective*` 和 `serverNow`，不能因客户端发现订阅成功就直接展示可访问。

#### 日志与指标

服务端日志统一使用 `[PublishingRecovery]`，记录触发来源、用户 ID、候选数、文件恢复数、在线网站转换数、静态网站恢复数、跳过数、是否仍有待处理候选和耗时；不得记录文件名、URL、分享码或本地路径。已停止 Node 服务在候选 SQL 中被排除，不计为失败或积压。

## 上线顺序

1. 备份并执行 V77 数据库迁移。
2. 发布包含新配置、额度校验和访问守卫的服务端。
3. 发布服务端订阅提交后事件、恢复服务和 Library 第一页兜底；确认自动检查始终不会启动已停止 Node 服务。
4. 验证额度接口、Library `effective*` 与可选 `recoveryPending`。
5. 发布支持 3/10/30 秒有界刷新和订阅事件失效缓存的客户端。

回滚服务端时可保留可空字段。不要先发布依赖新字段的服务端代码再执行迁移。

## 验证重点

- 普通用户第 10/1 个资源可创建，第 11/2 个并发创建也必须失败。
- 关闭、过期、删除普通资源后累计额度不恢复。
- 普通资源更新不改变原截止时间，边界 `now == accessExpiresAt` 即失效。
- 订阅退款/取消、自然到期、企业停用、成员移除的失效时间分别正确。
- 身份失效超过 7 天后只在访问目标链接时关闭该链接；恢复身份后不自动恢复这类“权益宽限期结束”资源。
- 身份失效超过 7 天但尚未触发关闭时，Library 原始状态可以仍为 `live`，但 `effectiveAvailable=false`，客户端必须显示不可访问；恢复身份后刷新会恢复有效投影。
- 客户端云端列表的文件和网站共用服务端时间基准，过期后无需网络轮询即可更新状态。
- 普通用户限时资源升级订阅后，未到期和已因固定时限到期的文件均自动转换；原 URL、权限模式和分享码不变。
- 用户/管理员/审核/额度关闭不会被恢复；订阅激活、云端第一页和补偿任务并发触发时结果幂等。
- 已停止静态网站只有自动恢复成功后可访问；失败或来源缺失保持不可访问。已停止 Node 服务在自动检查后仍不可访问，且没有部署请求；用户主动重新部署成功后才恢复。
- 订阅激活成功不受恢复失败影响；用户首次进入云端页会再次自动检查。
- 恢复方案没有新增表或 DDL，候选 SQL 与条件更新通过 MySQL 5.7 验证。
