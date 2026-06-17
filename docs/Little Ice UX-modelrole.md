# Little Ice UX 更新内容

## 一、信息架构（IA）

```text
Little Ice

├── Chat
├── Favorite
├── Model Role
└── Settings
```

说明：

* Favorite 保持现状
* 新增 Model Role 模块
* Model Role 为一级导航模块
* 不放入 Settings

---

## 二、Model Role 模块

### 功能定位

Model Role 用于管理模型角色。

每个模型角色对应一套 Prompt 模板。

用户与 AI 对话时：

```text
Role Prompt
+
Chat History
+
User Message
```

共同发送给模型。

---

### Role 数据模型

```text
Role

id

name

responsibility

isBuiltin

createdAt

updatedAt
```

字段说明：

```text
name
角色名称

responsibility
角色职责
实际作为 System Prompt 发送给模型

isBuiltin
是否系统角色
```

---

### 系统角色

系统内置：

```text
默认助手
```

属性：

```text
isBuiltin = true
```

限制：

```text
不可编辑名称

不可编辑职责

不可删除
```

仅允许查看。

---

### 自定义角色

支持：

```text
新建

编辑

删除
```

用户可以创建：

```text
产品经理

需求分析师

UX设计师

前端架构师

后端架构师

测试工程师
```

等专业角色。

---

## ## 三、Model Role 页面

布局参考 Favorite 模块。

采用左右布局：

```text
┌──────────────┬──────────────────────┐
│              │                      │
│ Model Roles ＋│  Role Detail         │
│              │                      │
│ 默认助手      │ 名称                 │
│ 产品经理      │                      │
│ UX设计师      │ 职责                 │
│ 前端架构师    │                      │
│              │                      │
│              │                      │
│              │      保存            │
└──────────────┴──────────────────────┘
```

### 左侧

显示：

```text
Role List
```

Header：

```text
Model Roles
```

右侧显示：

```text
＋新建
```

用于创建新的 Model Role。

支持：

```text
选择

新建

删除
```

说明：

- 「新建」按钮位于 Role List Header 右侧

- 点击后创建新的自定义 Role

- 不在列表内容区域显示「+ 新建」项

### 右侧

显示：

```text
名称

职责
```

支持：

```text
编辑

保存
```

系统角色：

```text
默认助手
```

只读显示。

---

## 四、Chat 与 Role 关联

### Chat 数据模型

新增字段：

```text
roleId
```

完整结构：

```text
Chat

id

title

roleId

createdAt

updatedAt
```

说明：

```text
roleId
关联 Role.id
```

---

### 关联规则

```text
一个 Chat
对应
一个 Role
```

整个会话始终使用同一个 Role。

不支持单条消息切换 Role。

---

## 五、Chat 列表

保持现有设计。

显示：

```text
Little Ice MVP

数据库设计

需求分析
```

不显示：

```text
角色标签
```

避免界面复杂化。

---

## 六、Chat 列表操作

原设计：

```text
编辑图标

删除图标
```

调整为：

```text
...
```

统一菜单入口。

---

### 一级菜单

```text
模型角色 ▶

编辑

删除
```

---

### 二级菜单

鼠标移动到：

```text
模型角色
```

弹出：

```text
默认助手

产品经理

需求分析师

UX设计师

前端架构师

后端架构师
```

当前角色显示：

```text
✓
```

例如：

```text
默认助手

产品经理

需求分析师

✓ UX设计师

前端架构师

后端架构师
```

---

### 修改角色

用户选择角色后：

```text
chat.roleId
=
selectedRole.id
```

立即保存。

无需确认对话框。

---

## 七、Chat 页面

Chat Header 显示：

```text
当前对话标题
```

下方显示：

```text
Role：前端架构师
```

或：

```text
[前端架构师]
```

用于提示当前会话绑定的角色。

---

## 八、消息发送流程

用户发送消息：

```text
用户问题
```

系统读取：

```text
当前 Chat

↓

roleId

↓

Role
```

然后构造：

```json
[
  {
    "role": "system",
    "content": role.responsibility
  },

  ...historyMessages,

  {
    "role": "user",
    "content": userMessage
  }
]
```

发送给模型。

---

## 九、MVP 范围

本阶段仅实现：

```text
Model Role 管理

Role 与 Chat 关联

Role Prompt 注入
```

暂不实现：

```text
多智能体

Prompt 组合

Prompt 继承

上下文管理

知识引用

工作流
```

保持 MVP 简洁。
