# Frontend Architecture 增量设计：Model Role 模块

## 新增业务域

新增：

```text
domains/

├── chat
├── favorite
├── role
└── settings
```

其中：

```text
role
```

负责：

* Model Role 管理
* Role CRUD
* Chat 与 Role 关联

---

# 数据模型

## Role

```typescript
export interface Role {
  id: string;

  name: string;

  responsibility: string;

  isBuiltin: boolean;

  createdAt: string;

  updatedAt: string;
}
```

说明：

```text
responsibility
=
System Prompt
```

前端 UI 使用：

```text
职责
```

展示。

---

## Chat

新增：

```typescript
roleId: string;
```

完整结构：

```typescript
export interface Chat {
  id: string;

  title: string;

  roleId: string;

  createdAt: string;

  updatedAt: string;
}
```

---

# 路由结构

新增：

```text
/chat

/favorite

/roles

/settings
```

---

# 页面结构

新增：

```text
pages/

RolePage.tsx
```

负责：

```text
Role List

Role Detail
```

管理。

---

# RolePage 布局

```text
┌──────────────────────────────────────┐
│              RolePage                │
├──────────────┬───────────────────────┤
│              │                       │
│ Role List    │     Role Detail       │
│              │                       │
└──────────────┴───────────────────────┘
```

---

# 左侧区域

组件：

```text
RoleList
```

结构：

```text
RoleListHeader

RoleListContent
```

---

## RoleListHeader

显示：

```text
Model Roles          +
```

右侧：

```text
Add Role Button
```

点击：

```text
Create Role
```

---

## RoleListContent

显示：

```text
默认助手

产品经理

UX设计师

前端架构师
```

支持：

```text
选择

删除（非系统角色）
```

---

# 右侧区域

组件：

```text
RoleDetail
```

字段：

```text
名称

职责
```

按钮：

```text
保存
```

---

## 系统角色

```text
isBuiltin = true
```

行为：

```text
名称只读

职责只读

隐藏删除按钮
```

---

# 状态管理

新增：

```text
stores/

roleStore.ts
```

职责：

```text
Role List

Selected Role

CRUD
```

---

## RoleStore

```typescript
interface RoleStore {
  roles: Role[];

  selectedRoleId: string | null;

  loadRoles(): Promise<void>;

  createRole(): Promise<void>;

  updateRole(): Promise<void>;

  deleteRole(): Promise<void>;

  selectRole(id: string): void;
}
```

---

# Repository

新增：

```text
repositories/

RoleRepository.ts
```

接口：

```typescript
interface RoleRepository {
  getAll(): Promise<Role[]>;

  getById(id: string): Promise<Role | null>;

  create(role: Role): Promise<void>;

  update(role: Role): Promise<void>;

  delete(id: string): Promise<void>;
}
```

---

# Chat 与 Role 关联

Chat 实体新增：

```typescript
roleId: string;
```

---

# Chat List 菜单

原：

```text
编辑

删除
```

调整为：

```text
模型角色 ▶

编辑

删除
```

---

# 二级菜单

动态读取：

```typescript
roleStore.roles
```

生成菜单：

```text
默认助手

产品经理

需求分析师

UX设计师

前端架构师
```

当前 Role：

```text
✓
```

标记。

---

# 修改 Role

点击菜单项：

```typescript
chat.roleId = selectedRole.id;
```

然后：

```typescript
await chatRepository.update(chat);
```

立即保存。

---

# Chat Header

新增：

```text
RoleBadge
```

显示：

```text
当前角色
```

例如：

```text
Little Ice MVP

[前端架构师]
```

---

# 模型调用上下文

发送消息前：

```typescript
const role =
  await roleRepository.getById(chat.roleId);
```

构造：

```typescript
[
  {
    role: "system",
    content: role.responsibility
  },

  ...historyMessages,

  {
    role: "user",
    content: userMessage
  }
]
```

发送给 AI Provider。

---

# MVP 范围

本阶段实现：

```text
Role CRUD

Role List

Role Detail

Role 与 Chat 关联

Role Prompt 注入
```

不实现：

```text
Prompt 组合

Role 继承

Role Marketplace

Agent

Workflow
```
