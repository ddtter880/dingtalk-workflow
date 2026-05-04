// 项目状态枚举
export enum ProjectStatus {
  NEW = 'new',           // 新增
  PROCESSING = 'processing', // 待处理
  PENDING_CLOSE = 'pending_close', // 待销项
  CLOSED = 'closed',     // 已销项
}

// 紧急重要程度
export enum UrgencyLevel {
  URGENT_IMPORTANT = 'urgent_important', // 紧急且重要
  URGENT = 'urgent',                     // 紧急不重要
  IMPORTANT = 'important',               // 重要不紧急
  NORMAL = 'normal',                     // 不紧急不重要
}

// 用户角色
export enum UserRole {
  PROJECT_MANAGER = 'project_manager', // 项目负责人
  DEPT_HEAD = 'dept_head',             // 室所主任
  LEADER = 'leader',                     // 分管领导
  SAFETY = 'safety',                     // 质量安全人员
  ADMIN = 'admin',                       // 管理员
}

// 状态标签配置
export const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  [ProjectStatus.NEW]: { label: '新增', color: '#2563EB', bgColor: '#DBEAFE' },
  [ProjectStatus.PROCESSING]: { label: '待处理', color: '#D97706', bgColor: '#FEF3C7' },
  [ProjectStatus.PENDING_CLOSE]: { label: '待销项', color: '#DB2777', bgColor: '#FCE7F3' },
  [ProjectStatus.CLOSED]: { label: '已销项', color: '#6B7280', bgColor: '#F3F4F6' },
}

// 优先级配置
export const URGENCY_CONFIG: Record<string, { label: string; icon: string; color: string; borderColor: string; bgColor: string }> = {
  [UrgencyLevel.URGENT_IMPORTANT]: {
    label: '紧急重要', icon: '★★', color: '#DC2626', borderColor: '#DC2626', bgColor: '#FEF2F2',
  },
  [UrgencyLevel.URGENT]: {
    label: '紧急', icon: '★☆', color: '#EA580C', borderColor: '#EA580C', bgColor: '#FFF7ED',
  },
  [UrgencyLevel.IMPORTANT]: {
    label: '重要', icon: '☆★', color: '#2563EB', borderColor: '#2563EB', bgColor: '#EFF6FF',
  },
  [UrgencyLevel.NORMAL]: {
    label: '一般', icon: '☆☆', color: '#9CA3AF', borderColor: '#9CA3AF', bgColor: '#F9FAFB',
  },
}

// 角色配置
export const ROLE_CONFIG: Record<string, { label: string; order: number }> = {
  [UserRole.PROJECT_MANAGER]: { label: '项目负责人', order: 1 },
  [UserRole.DEPT_HEAD]: { label: '室所主任', order: 2 },
  [UserRole.LEADER]: { label: '分管领导', order: 3 },
  [UserRole.SAFETY]: { label: '质量安全人员', order: 4 },
  [UserRole.ADMIN]: { label: '管理员', order: 99 },
}

// 表单字段定义
export interface ProjectFormData {
  work_name: string
  work_requirement: string
  responsible_dept: string
  responsible_person: string
  responsible_leader: string
  plan_finish_date: string
  actual_finish_date: string
  risk_impact: string
  progress: string
  coordination_needs: string
  suggestion: string
  meeting_notes: string
  urgency_level: UrgencyLevel
  is_pending_close: boolean
  remark: string
}

// 项目完整数据（添加索引签名以支持动态字段访问）
export interface Project extends ProjectFormData {
  project_id: string
  category: ProjectStatus
  created_by: string
  created_week: string
  updated_at: string
  [key: string]: any // 支持动态字段访问
}

// 历史记录
export interface HistoryRecord {
  record_id: string
  project_id: string
  version: number
  operator_id: string
  operator_role: UserRole
  field_name: string
  old_value: string
  new_value: string
  operated_at: string
}

// 人员配置
export interface PersonnelConfig {
  project_id: string
  project_manager: string
  dept_head: string
  leader: string
  safety_officer: string
}

// 系统配置
export interface SystemConfig {
  auto_delete_days: number
  robot_webhook: string
  remind_schedule: string
  push_targets: string[]
}

// 垃圾箱记录
export interface RecycleBinItem {
  project_id: string
  closed_by: string
  closed_at: string
  auto_delete_date: string
  work_name: string
  // 保存完整项目数据以便恢复
  project_data: string  // JSON序列化的完整Project对象
}
