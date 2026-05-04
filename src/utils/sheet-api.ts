/**
 * 钉钉在线表格数据访问层
 * 自动适配钉钉环境和开发环境：
 * - 钉钉环境：通过服务端API读写在线表格
 * - 开发环境：使用localStorage模拟
 *
 * 表格结构映射：
 * Sheet1: projects（项目主表）
 * Sheet2: history（历史记录表）
 * Sheet3: personnel（人员配置表）
 * Sheet4: recycle_bin（垃圾箱表）
 */

import type { Project, HistoryRecord, PersonnelConfig, RecycleBinItem, SystemConfig } from './constants'
import { ProjectStatus, UrgencyLevel } from './constants'
import { isDingTalkEnv, fetchSheetData, appendSheetData, updateSheetData, DINGTALK_SHEET_ID } from './dingtalk'

// ==================== Sheet ID 映射 ====================
// 钉钉在线表格中各工作表的ID（需要在钉钉表格中创建后替换）
const SHEET_IDS = {
  PROJECTS: 'projects',     // 项目主表
  HISTORY: 'history',       // 历史记录表
  PERSONNEL: 'personnel',   // 人员配置表
  RECYCLE_BIN: 'recycle',   // 垃圾箱表
}

// localStorage keys（降级使用）
const STORAGE_KEYS = {
  PROJECTS: 'dt_projects',
  HISTORY: 'dt_history',
  PERSONNEL: 'dt_personnel',
  RECYCLE_BIN: 'dt_recycle_bin',
  CONFIG: 'dt_config',
}

// ==================== 通用工具 ====================

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 11)
}

function getStorage<T>(key: string): T[] {
  try {
    const data = localStorage.getItem(key)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

function setStorage<T>(key: string, data: T[]): void {
  localStorage.setItem(key, JSON.stringify(data))
}

/** 是否使用在线表格模式 */
function useOnlineSheet(): boolean {
  return isDingTalkEnv() && !!DINGTALK_SHEET_ID
}

// ==================== 项目CRUD ====================

// 获取当前周次
function getCurrentWeek(): string {
  const now = new Date()
  const startOfYear = new Date(now.getFullYear(), 0, 1)
  const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000)) + 1
  const weekNumber = Math.ceil(dayOfYear / 7)
  return `${now.getFullYear()}-W${weekNumber.toString().padStart(2, '0')}`
}

/** 获取所有项目 */
export function getProjects(): Project[] {
  return getStorage<Project>(STORAGE_KEYS.PROJECTS)
}

/** 根据状态筛选项目 */
export function getProjectsByStatus(status: ProjectStatus): Project[] {
  return getProjects().filter(p => p.category === status)
}

/** 根据ID获取项目 */
export function getProjectById(id: string): Project | undefined {
  return getProjects().find(p => p.project_id === id)
}

/** 创建项目 */
export function createProject(data: Omit<Project, 'project_id' | 'updated_at'>): Project {
  const projects = getProjects()
  const now = new Date().toISOString()
  const project: Project = {
    work_name: data.work_name,
    work_requirement: data.work_requirement,
    responsible_dept: data.responsible_dept,
    responsible_person: data.responsible_person,
    responsible_leader: data.responsible_leader,
    plan_finish_date: data.plan_finish_date,
    actual_finish_date: data.actual_finish_date,
    risk_impact: data.risk_impact,
    progress: data.progress,
    coordination_needs: data.coordination_needs,
    suggestion: data.suggestion,
    meeting_notes: data.meeting_notes,
    urgency_level: data.urgency_level,
    is_pending_close: data.is_pending_close,
    remark: data.remark,
    project_id: generateId(),
    category: data.category,
    created_by: data.created_by,
    created_week: data.created_week || getCurrentWeek(),
    updated_at: now,
  }

  projects.push(project)
  setStorage(STORAGE_KEYS.PROJECTS, projects)

  // 同步到在线表格（异步，不阻塞）
  if (useOnlineSheet()) {
    syncProjectToSheet(project)
  }

  return project
}

/** 更新项目 */
export function updateProject(id: string, data: Partial<Project>): Project | null {
  const projects = getProjects()
  const index = projects.findIndex(p => p.project_id === id)
  if (index === -1) return null

  projects[index] = {
    ...projects[index],
    ...data,
    updated_at: new Date().toISOString(),
  }
  setStorage(STORAGE_KEYS.PROJECTS, projects)

  // 同步到在线表格
  if (useOnlineSheet()) {
    syncProjectUpdateToSheet(id, projects[index])
  }

  return projects[index]
}

/** 删除项目（移入垃圾箱） */
export function deleteProject(id: string): boolean {
  const projects = getProjects()
  const project = projects.find(p => p.project_id === id)
  if (!project) return false

  // 添加到垃圾箱
  const recycleBin = getStorage<RecycleBinItem>(STORAGE_KEYS.RECYCLE_BIN)
  const recycleItem: RecycleBinItem = {
    project_id: project.project_id,
    closed_by: project.created_by,
    closed_at: new Date().toISOString(),
    auto_delete_date: '',
    work_name: project.work_name,
    project_data: JSON.stringify(project),
  }
  recycleBin.push(recycleItem)
  setStorage(STORAGE_KEYS.RECYCLE_BIN, recycleBin)

  // 从项目列表移除
  const filtered = projects.filter(p => p.project_id !== id)
  setStorage(STORAGE_KEYS.PROJECTS, filtered)

  // 同步到在线表格
  if (useOnlineSheet()) {
    // 追加到垃圾箱表
    const row = [
      recycleItem.project_id,
      recycleItem.closed_by,
      recycleItem.closed_at,
      recycleItem.work_name,
      recycleItem.project_data,
    ]
    appendSheetData(SHEET_IDS.RECYCLE_BIN, [row]).catch(e =>
      console.error('[Sheet] 同步垃圾箱失败:', e)
    )
  }

  return true
}

// ==================== 在线表格同步（异步） ====================

/** 将新项目同步到在线表格 */
async function syncProjectToSheet(project: Project): Promise<void> {
  try {
    const row = [
      project.project_id,
      project.work_name,
      project.category,
      project.work_requirement,
      project.responsible_dept,
      project.responsible_person,
      project.responsible_leader,
      project.plan_finish_date,
      project.actual_finish_date,
      project.risk_impact,
      project.progress,
      project.coordination_needs,
      project.suggestion,
      project.meeting_notes,
      project.urgency_level,
      project.is_pending_close ? '是' : '否',
      project.remark,
      project.created_by,
      project.created_week,
      project.updated_at,
    ]
    await appendSheetData(SHEET_IDS.PROJECTS, [row])
  } catch (e) {
    console.error('[Sheet] 同步项目到在线表格失败:', e)
  }
}

/** 将项目更新同步到在线表格 */
async function syncProjectUpdateToSheet(id: string, project: Project): Promise<void> {
  try {
    // 先在表格中查找该项目的行号
    const data = await fetchSheetData(SHEET_IDS.PROJECTS, 'A:A')
    if (!data) return

    let rowNum = -1
    for (let i = 1; i < data.length; i++) { // 跳过表头
      if (data[i][0] === id) {
        rowNum = i + 1 // 转为1-based行号
        break
      }
    }

    if (rowNum === -1) return

    const row = [
      project.project_id,
      project.work_name,
      project.category,
      project.work_requirement,
      project.responsible_dept,
      project.responsible_person,
      project.responsible_leader,
      project.plan_finish_date,
      project.actual_finish_date,
      project.risk_impact,
      project.progress,
      project.coordination_needs,
      project.suggestion,
      project.meeting_notes,
      project.urgency_level,
      project.is_pending_close ? '是' : '否',
      project.remark,
      project.created_by,
      project.created_week,
      project.updated_at,
    ]

    await updateSheetData(SHEET_IDS.PROJECTS, `A${rowNum}:T${rowNum}`, [row])
  } catch (e) {
    console.error('[Sheet] 同步项目更新到在线表格失败:', e)
  }
}

/** 从在线表格拉取全量数据到本地（启动时调用） */
export async function syncFromSheet(): Promise<void> {
  if (!useOnlineSheet()) return

  try {
    // 拉取项目数据
    const projectData = await fetchSheetData(SHEET_IDS.PROJECTS, 'A2:T10000')
    if (projectData && projectData.length > 0) {
      const projects: Project[] = projectData
        .filter(row => row[0]) // 过滤空行
        .map(row => ({
          project_id: row[0] || '',
          work_name: row[1] || '',
          category: (row[2] as ProjectStatus) || ProjectStatus.NEW,
          work_requirement: row[3] || '',
          responsible_dept: row[4] || '',
          responsible_person: row[5] || '',
          responsible_leader: row[6] || '',
          plan_finish_date: row[7] || '',
          actual_finish_date: row[8] || '',
          risk_impact: row[9] || '',
          progress: row[10] || '',
          coordination_needs: row[11] || '',
          suggestion: row[12] || '',
          meeting_notes: row[13] || '',
          urgency_level: (row[14] as UrgencyLevel) || UrgencyLevel.NORMAL,
          is_pending_close: row[15] === '是',
          remark: row[16] || '',
          created_by: row[17] || '',
          created_week: row[18] || '',
          updated_at: row[19] || '',
        }))

      // 合并：以在线表格为准，但保留本地未同步的新增
      const localProjects = getStorage<Project>(STORAGE_KEYS.PROJECTS)
      const localOnlyProjects = localProjects.filter(
        lp => !projects.some(sp => sp.project_id === lp.project_id)
      )

      setStorage(STORAGE_KEYS.PROJECTS, [...projects, ...localOnlyProjects])
      console.log(`[Sheet] 同步了 ${projects.length} 个项目，${localOnlyProjects.length} 个本地待同步`)
    }
  } catch (e) {
    console.error('[Sheet] 从在线表格拉取数据失败:', e)
  }
}

// ==================== 自动清理与提醒 ====================

/** 自动清理过期的垃圾箱项目 */
export function autoCleanRecycleBin(): number {
  const config = getSystemConfig()
  const days = config.auto_delete_days || 30
  const recycleBin = getStorage<RecycleBinItem>(STORAGE_KEYS.RECYCLE_BIN)
  const now = new Date()

  const expired = recycleBin.filter(item => {
    const closedAt = new Date(item.closed_at)
    const diffDays = Math.floor((now.getTime() - closedAt.getTime()) / (1000 * 60 * 60 * 24))
    return diffDays >= days
  })

  if (expired.length > 0) {
    const remaining = recycleBin.filter(item => !expired.some(e => e.project_id === item.project_id))
    setStorage(STORAGE_KEYS.RECYCLE_BIN, remaining)
    console.log(`[Sheet] 自动清理了 ${expired.length} 个过期垃圾箱项目（超过${days}天）`)
  }

  return expired.length
}

/** 获取需要提醒的项目（未处理项目列表） */
export function getProjectsNeedingAttention(): Project[] {
  const projects = getProjects()
  return projects.filter(p =>
    p.category === ProjectStatus.NEW ||
    p.category === ProjectStatus.PROCESSING ||
    p.category === ProjectStatus.PENDING_CLOSE
  )
}

/** 检查是否需要发送周提醒（每周一检查） */
export function shouldSendWeeklyReminder(): boolean {
  const now = new Date()
  const dayOfWeek = now.getDay() // 0=周日, 1=周一
  if (dayOfWeek !== 1) return false // 仅周一

  const lastReminder = localStorage.getItem('dt_last_reminder')
  if (lastReminder) {
    const lastDate = new Date(lastReminder)
    // 同一周内不重复发送
    if (lastDate.getTime() > now.getTime() - 7 * 24 * 60 * 60 * 1000) {
      return false
    }
  }

  return true
}

/** 标记本周已发送提醒 */
export function markReminderSent(): void {
  localStorage.setItem('dt_last_reminder', new Date().toISOString())
}

// ==================== 历史记录 ====================

export function addHistoryRecord(data: Omit<HistoryRecord, 'record_id'>): HistoryRecord {
  const records = getStorage<HistoryRecord>(STORAGE_KEYS.HISTORY)
  const record: HistoryRecord = {
    ...data,
    record_id: generateId(),
  }
  records.push(record)
  setStorage(STORAGE_KEYS.HISTORY, records)

  // 同步到在线表格
  if (useOnlineSheet()) {
    const row = [
      record.record_id,
      record.project_id,
      String(record.version),
      record.operator_id,
      record.operator_role,
      record.field_name,
      record.old_value,
      record.new_value,
      record.operated_at,
    ]
    appendSheetData(SHEET_IDS.HISTORY, [row]).catch(e =>
      console.error('[Sheet] 同步历史记录失败:', e)
    )
  }

  return record
}

export function getProjectHistory(projectId: string): HistoryRecord[] {
  return getStorage<HistoryRecord>(STORAGE_KEYS.HISTORY)
    .filter(r => r.project_id === projectId)
    .sort((a, b) => new Date(b.operated_at).getTime() - new Date(a.operated_at).getTime())
}

// ==================== 人员配置 ====================

export function getPersonnelConfigs(): PersonnelConfig[] {
  return getStorage<PersonnelConfig>(STORAGE_KEYS.PERSONNEL)
}

export function getProjectPersonnel(projectId: string): PersonnelConfig | undefined {
  return getStorage<PersonnelConfig>(STORAGE_KEYS.PERSONNEL)
    .find(p => p.project_id === projectId)
}

export function savePersonnelConfig(config: PersonnelConfig): PersonnelConfig {
  const configs = getStorage<PersonnelConfig>(STORAGE_KEYS.PERSONNEL)
  const index = configs.findIndex(c => c.project_id === config.project_id)

  if (index >= 0) {
    configs[index] = config
  } else {
    configs.push(config)
  }
  setStorage(STORAGE_KEYS.PERSONNEL, configs)

  // 同步到在线表格
  if (useOnlineSheet()) {
    const row = [
      config.project_id,
      config.project_leader || '',
      config.dept_head || '',
      config.leader || '',
      config.safety_person || '',
    ]
    // 先尝试查找已有记录
    fetchSheetData(SHEET_IDS.PERSONNEL, 'A:A').then(ids => {
      if (ids) {
        const rowIdx = ids.findIndex((r: string[]) => r[0] === config.project_id)
        if (rowIdx >= 0) {
          updateSheetData(SHEET_IDS.PERSONNEL, `A${rowIdx + 1}:E${rowIdx + 1}`, [row]).catch(e =>
            console.error('[Sheet] 同步人员配置(更新)失败:', e)
          )
        } else {
          appendSheetData(SHEET_IDS.PERSONNEL, [row]).catch(e =>
            console.error('[Sheet] 同步人员配置(追加)失败:', e)
          )
        }
      }
    }).catch(e =>
      console.error('[Sheet] 查询人员配置失败:', e)
    )
  }

  return config
}

// ==================== 垃圾箱 ====================

export function getRecycleBinItems(): RecycleBinItem[] {
  return getStorage<RecycleBinItem>(STORAGE_KEYS.RECYCLE_BIN)
}

export function restoreProject(projectId: string): boolean {
  const recycleBin = getStorage<RecycleBinItem>(STORAGE_KEYS.RECYCLE_BIN)
  const item = recycleBin.find(r => r.project_id === projectId)
  if (!item) return false

  let restoredProject: Project
  if (item.project_data) {
    try {
      restoredProject = {
        ...JSON.parse(item.project_data),
        category: ProjectStatus.PROCESSING,
        updated_at: new Date().toISOString(),
      }
    } catch {
      return false
    }
  } else {
    restoredProject = {
      project_id: item.project_id,
      work_name: item.work_name,
      category: ProjectStatus.PROCESSING,
      work_requirement: '',
      responsible_dept: '',
      responsible_person: '',
      responsible_leader: '',
      plan_finish_date: '',
      actual_finish_date: '',
      risk_impact: '',
      progress: '',
      coordination_needs: '',
      suggestion: '',
      meeting_notes: '',
      urgency_level: UrgencyLevel.NORMAL,
      is_pending_close: false,
      remark: '',
      created_by: item.closed_by,
      created_week: '',
      updated_at: new Date().toISOString(),
    }
  }

  const projects = getProjects()
  projects.push(restoredProject)
  setStorage(STORAGE_KEYS.PROJECTS, projects)

  const filtered = recycleBin.filter(r => r.project_id !== projectId)
  setStorage(STORAGE_KEYS.RECYCLE_BIN, filtered)

  // 同步到在线表格：从垃圾箱表删除
  if (useOnlineSheet()) {
    fetchSheetData(SHEET_IDS.RECYCLE_BIN, 'A:A').then(ids => {
      if (ids) {
        const rowIdx = ids.findIndex((r: string[]) => r[0] === projectId)
        if (rowIdx >= 0) {
          updateSheetData(SHEET_IDS.RECYCLE_BIN, `A${rowIdx + 1}:E${rowIdx + 1}`, [['', '', '', '', '']]).catch(e =>
            console.error('[Sheet] 清除垃圾箱记录失败:', e)
          )
        }
      }
    }).catch(e => console.error('[Sheet] 查询垃圾箱失败:', e))
  }

  return true
}

export function permanentDelete(projectId: string): boolean {
  const recycleBin = getStorage<RecycleBinItem>(STORAGE_KEYS.RECYCLE_BIN)
  const filtered = recycleBin.filter(r => r.project_id !== projectId)
  setStorage(STORAGE_KEYS.RECYCLE_BIN, filtered)

  const history = getStorage<HistoryRecord>(STORAGE_KEYS.HISTORY)
  const filteredHistory = history.filter(r => r.project_id !== projectId)
  setStorage(STORAGE_KEYS.HISTORY, filteredHistory)

  const personnel = getStorage<PersonnelConfig>(STORAGE_KEYS.PERSONNEL)
  const filteredPersonnel = personnel.filter(p => p.project_id !== projectId)
  setStorage(STORAGE_KEYS.PERSONNEL, filteredPersonnel)

  return true
}

// ==================== 系统配置 ====================

const DEFAULT_CONFIG: SystemConfig = {
  auto_delete_days: 30,
  robot_webhook: '',
  remind_schedule: '周一 09:00',
  push_targets: [],
}

export function getSystemConfig(): SystemConfig {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.CONFIG)
    return data ? { ...DEFAULT_CONFIG, ...JSON.parse(data) } : DEFAULT_CONFIG
  } catch {
    return DEFAULT_CONFIG
  }
}

export function saveSystemConfig(config: Partial<SystemConfig>): SystemConfig {
  const current = getSystemConfig()
  const updated = { ...current, ...config }
  localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(updated))
  return updated
}

// ==================== 初始化示例数据 ====================

export function initMockData(): void {
  const projects = getProjects()
  if (projects.length > 0) return

  const mockProjects: Project[] = [
    {
      project_id: 'demo1',
      work_name: '杭州市临安区里畈水库加高扩容工程',
      category: ProjectStatus.NEW,
      work_requirement: '原总承包合同未包含水库清淤工作项目',
      responsible_dept: '设计部',
      responsible_person: '刘航',
      responsible_leader: '王总',
      plan_finish_date: '2026-04-30',
      actual_finish_date: '',
      risk_impact: '影响工程进度',
      progress: '目前项建还在水利部，施工概算正常进行',
      coordination_needs: '需与业主讨论合同条款',
      suggestion: '建议项目部与施工单位沟通',
      meeting_notes: '',
      urgency_level: UrgencyLevel.URGENT_IMPORTANT,
      is_pending_close: false,
      remark: '',
      created_by: 'user_liuhang',
      created_week: '2026-W17',
      updated_at: '2026-04-28T10:00:00Z',
    },
    {
      project_id: 'demo2',
      work_name: '浙东南水资源配置工程',
      category: ProjectStatus.PROCESSING,
      work_requirement: '4月底完成项建',
      responsible_dept: '机电部',
      responsible_person: '何伟',
      responsible_leader: '李总',
      plan_finish_date: '2026-04-30',
      actual_finish_date: '',
      risk_impact: '目前只提供了机电金结工程量',
      progress: '项建报告编制中',
      coordination_needs: '需要水文数据支持',
      suggestion: '联系水文部门获取数据',
      meeting_notes: '',
      urgency_level: UrgencyLevel.IMPORTANT,
      is_pending_close: false,
      remark: '',
      created_by: 'user_hewei',
      created_week: '2026-W15',
      updated_at: '2026-04-27T14:00:00Z',
    },
    {
      project_id: 'demo3',
      work_name: '淳安县秋口水库工程',
      category: ProjectStatus.PROCESSING,
      work_requirement: '根据评审会最新复审意见近期修改完成',
      responsible_dept: '水工部',
      responsible_person: '谢宇琦',
      responsible_leader: '张总',
      plan_finish_date: '2026-05-15',
      actual_finish_date: '',
      risk_impact: '',
      progress: '正在修改可研报告',
      coordination_needs: '',
      suggestion: '',
      meeting_notes: '',
      urgency_level: UrgencyLevel.NORMAL,
      is_pending_close: false,
      remark: '',
      created_by: 'user_xieyuqi',
      created_week: '2026-W14',
      updated_at: '2026-04-26T09:00:00Z',
    },
    {
      project_id: 'demo4',
      work_name: '开化县水库除险加固工程',
      category: ProjectStatus.PENDING_CLOSE,
      work_requirement: '完成初步设计审查',
      responsible_dept: '设计部',
      responsible_person: '胡蓉',
      responsible_leader: '王总',
      plan_finish_date: '2026-04-20',
      actual_finish_date: '2026-04-18',
      risk_impact: '',
      progress: '初步设计已通过审查',
      coordination_needs: '',
      suggestion: '',
      meeting_notes: '',
      urgency_level: UrgencyLevel.URGENT,
      is_pending_close: true,
      remark: '',
      created_by: 'user_hurong',
      created_week: '2026-W12',
      updated_at: '2026-04-25T16:00:00Z',
    },
  ]

  setStorage(STORAGE_KEYS.PROJECTS, mockProjects)

  const mockPersonnel: PersonnelConfig[] = [
    { project_id: 'demo1', project_manager: 'user_liuhang', dept_head: 'user_zhangsan', leader: 'user_wangzong', safety_officer: 'user_zhaoliu' },
    { project_id: 'demo2', project_manager: 'user_hewei', dept_head: 'user_lisi', leader: 'user_lizong', safety_officer: 'user_zhaoliu' },
    { project_id: 'demo3', project_manager: 'user_xieyuqi', dept_head: 'user_wangwu', leader: 'user_zhangzong', safety_officer: 'user_zhaoliu' },
    { project_id: 'demo4', project_manager: 'user_hurong', dept_head: 'user_zhangsan', leader: 'user_wangzong', safety_officer: 'user_zhaoliu' },
  ]
  setStorage(STORAGE_KEYS.PERSONNEL, mockPersonnel)
}
