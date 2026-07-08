# AI叙事与上下文管理设计

## 1. AI职责边界

AI负责：

- 生成下一段剧情/对话内容（叙事文本）
- 生成可交互的选项（按钮/建议输入）
- 生成或引入新角色（NPC）及其初始属性/技能/阵营/关系
- 给出结构化的“状态变化建议”（由系统最终校验并落盘）

系统负责：

- 规则强校验（死亡、药物救助、属性下限/上限、物品数量、金钱不为负等）
- 结算与存档写入
- 上下文窗口管理与压缩

## 2. 事件记录系统（结构化日志）

每次触发剧情/对话/战斗结算，写入一条事件记录 EventRecord。

### 2.1 EventRecord字段（建议）

- event_id：全局唯一ID（建议ULID或UUID）
- ts：时间戳（或游戏内时间 + 真实时间）
- location：地点（字符串 + 可选坐标/区域ID）
- scene_type：dialogue / combat / travel / trade / rest / quest 等
- participants：参与角色ID列表（含主角）
- dialogue：
  - turns：对话轮数组（每轮包含 speaker_id、text、intent_tags 可选）
- deltas：
  - hp_delta/mp_delta/exp_delta/money_delta
  - items_delta（增减列表）
  - skills_delta（新增/升级）
  - favor_delta（对每个NPC的变化）
  - flags_delta（世界/任务flag变化）
- outcome：本事件结果摘要（短句）
- ai_summary：AI生成的“本事件一句话总结”（用于压缩）
- ai_trace（可选）：用于调试的元信息（生产环境可不保存或脱敏保存）

### 2.2 角色数据（建议拆分）

- Character（角色基础信息）：id、name、faction、type、level、stats、skills、traits
- Relation（关系）：from_id、to_id、favor、notes（关系由事件累积更新）

## 3. 动态压缩策略（上下文窗口管理）

目标：每次请求大模型时，把“足够连贯的上下文”控制在可用窗口内，同时保留可追溯性。

建议采用两层结构：

- RecentLog：最近K条事件（详细）
- LongSummary：更早历史的压缩摘要（可分章节/按地点/按关键角色聚合）

### 3.1 阈值与策略

- K（详细保留条数）：默认 50（可配置）
- 当事件数 > K：
  - 取最早的一段（例如 10~20 条）进行压缩，生成/更新 LongSummary
  - 将被压缩的原始事件移入 Archive（可选，本地存储，用于回放与调试）

### 3.2 压缩输出形态（建议）

- 时间线摘要：按“阶段”合并连续事件
- 关键事实列表：
  - 重要人物与关系变化（谁与主角结怨/结盟）
  - 关键物品/秘籍获得与消耗
  - 关键伤病/死亡边缘事件
  - 关键世界flag（门派冲突、通缉、誓言等）

LongSummary建议存两份：

- player_visible_summary：给玩家可回顾的摘要（叙事性强）
- model_context_summary：给模型的摘要（事实性强、结构化）

## 4. 向大模型发送的数据包（Context Packet）

每次触发剧情或对话，构造 ContextPacket，包含：

- rules：硬规则（死亡、药物救助、属性含义、不得凭空篡改存档等）
- player_state：主角快照（等级、属性、装备、物品、金钱、性格画像）
- known_characters：与本次场景关联的NPC（或可能出场者）
- relations：这些NPC对主角的favor与关系备注
- long_summary：model_context_summary
- recent_events：RecentLog（详细）
- current_prompt：本次玩家输入/本次想要触发的动作

### 4.1 “关联角色”筛选（建议）

为了避免把全部NPC都塞进上下文，按以下规则筛选：

- 必选：当前地点出现/当前事件participants
- 强相关：favor绝对值高、近期出现频繁、与当前任务flag相关
- 限额：最多N名（默认 8~12），超出则按“相关度评分”截断

## 5. 大模型输出协议（建议强结构化）

为保证可落盘与可校验，要求AI输出两部分：

1) narrative：面向玩家的叙事文本（可分段）
2) directives：结构化指令（系统可校验后应用）

directives建议字段：

- next_options：给玩家的选项数组（每项含 label、hint、risk 可选）
- new_characters：新角色数组（若无则为空）
- suggested_deltas：建议状态变化（由系统校验）
- hooks：为下一幕埋点（地点、任务线索、冲突点）

系统校验点（建议）：

- 不允许越权修改：例如直接把玩家金钱改成巨额、凭空加入关键道具
- 所有变化必须能被“本次事件”解释（或标注为“传闻/未知待证实”）
- 死亡规则必须优先：HP < 0 时必须进入救助判定/结局分支

## 6. 提示词模板（设计稿）

### 6.1 系统指令骨架

- 你是武侠江湖对话型文字游戏的叙事引擎
- 你必须遵守硬规则与输出协议
- 你必须在叙事中体现角色性格与关系变化
- 你必须给出可执行的结构化指令（directives）

### 6.2 用户指令骨架（拼装ContextPacket）

输入：

- rules: ...
- player_state: ...
- known_characters: ...
- relations: ...
- long_summary: ...
- recent_events: ...
- current_prompt: 玩家本轮输入

输出（固定JSON外壳，叙事允许换行）：

- narrative: string
- directives:
  - next_options: [{ label, hint }]
  - new_characters: [{ id, name, faction, type, level, stats, skills, initial_favor }]
  - suggested_deltas: { hp_delta, mp_delta, exp_delta, money_delta, items_delta, favor_delta, flags_delta }
  - hooks: string[]

## 7. 质量与安全约束（叙事一致性）

- 避免“穿帮信息”：不提及现实世界与模型身份
- 禁止无缘由的强行成功/失败：关键结果需与属性、选择、局势相关
- 保持可玩性：每轮至少提供1条推进剧情的选择（除结局）
- 保护玩家隐私：不要求玩家提供真实姓名、电话等信息

