/**
 * 钉钉JSAPI封装 + 服务端API调用层
 * 提供认证、待办、消息、通讯录等能力
 *
 * 架构说明：
 * - 前端JSAPI：在钉钉客户端内直接调用（免登、通讯录选择）
 * - 服务端API：通过 Vercel Serverless Functions 代理调用（需要appSecret的操作）
 */

// ==================== 环境配置 ====================

export const DINGTALK_CORP_ID = import.meta.env.VITE_DINGTALK_CORP_ID || ''
export const DINGTALK_AGENT_ID = import.meta.env.VITE_DINGTALK_AGENT_ID || ''
export const DINGTALK_APP_KEY = import.meta.env.VITE_DINGTALK_APP_KEY || ''
export const DINGTALK_ROBOT_WEBHOOK = import.meta.env.VITE_DINGTALK_ROBOT_WEBHOOK || ''
export const DINGTALK_SHEET_ID = import.meta.env.VITE_DINGTALK_SHEET_ID || ''

// 服务端API基础URL
const API_BASE = '/api'

// ==================== 环境检测 ====================

/** 判断是否在钉钉客户端环境 */
export function isDingTalkEnv(): boolean {
  return /DingTalk/i.test(navigator.userAgent)
}

/** 判断是否有服务端API可用 */
export function hasServerAPI(): boolean {
  // 如果部署在Vercel或有自定义后端
  return window.location.protocol === 'https:' || window.location.hostname === 'localhost'
}

// ==================== 初始化 ====================

/** 初始化钉钉JSAPI */
export async function initDingTalk(): Promise<void> {
  if (!isDingTalkEnv()) {
    console.log('[DingTalk] 非钉钉环境，使用模拟模式')
    return
  }

  try {
    const dd = (window as any).dd
    if (!dd) {
      console.error('[DingTalk] dd JSAPI 未加载')
      return
    }

    dd.config({
      agentId: DINGTALK_AGENT_ID,
      corpId: DINGTALK_CORP_ID,
      timeStamp: '',
      nonceStr: '',
      signature: '',
      type: 0,
      jsApiList: [
        'runtime.permission.requestAuthCode',
        'biz.contact.complexPicker',
        'biz.workrecord.add',
        'biz.workrecord.complete',
        'device.notification.alert',
        'device.notification.confirm',
      ],
    })

    dd.ready(() => {
      console.log('[DingTalk] JSAPI 就绪')
    })

    dd.error((err: any) => {
      console.error('[DingTalk] JSAPI 错误:', err)
    })
  } catch (e) {
    console.error('[DingTalk] 初始化失败:', e)
  }
}

// ==================== OAuth 免登 ====================

/** 获取免登authCode（JSAPI方式） */
export async function getAuthCode(): Promise<string> {
  if (!isDingTalkEnv()) {
    return 'mock_auth_code'
  }

  return new Promise((resolve, reject) => {
    const dd = (window as any).dd
    dd.ready(() => {
      dd.runtime.permission.requestAuthCode({
        corpId: DINGTALK_CORP_ID,
        onSuccess: (result: { code: string }) => {
          resolve(result.code)
        },
        onFail: (err: any) => {
          console.error('[DingTalk] 获取authCode失败:', err)
          reject(err)
        },
      })
    })
  })
}

/** 通过服务端API完成OAuth登录 */
export async function loginWithAuthCode(authCode: string): Promise<{
  userid: string
  name: string
  avatar?: string
  mobile?: string
  title?: string
  dept_id_list?: number[]
} | null> {
  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ authCode }),
    })

    const result = await response.json()

    if (result.success && result.data) {
      return result.data
    }

    console.error('[DingTalk] OAuth登录失败:', result.error)
    return null
  } catch (e) {
    console.error('[DingTalk] OAuth登录请求失败:', e)
    return null
  }
}

/** 完整的登录流程：获取authCode → 服务端换取用户信息 */
export async function performLogin(): Promise<{
  userid: string
  name: string
  avatar?: string
  mobile?: string
  title?: string
  dept_id_list?: number[]
} | null> {
  if (!isDingTalkEnv()) {
    // 非钉钉环境返回模拟用户
    console.log('[DingTalk] 非钉钉环境，使用模拟登录')
    return null
  }

  try {
    const authCode = await getAuthCode()
    const userInfo = await loginWithAuthCode(authCode)
    return userInfo
  } catch (e) {
    console.error('[DingTalk] 完整登录流程失败:', e)
    return null
  }
}

// ==================== 工作通知（通过服务端API） ====================

/** 发送工作通知给指定用户 */
export async function sendWorkNotification(params: {
  userid_list: string
  content: string
  msgtype?: 'text' | 'markdown'
  title?: string
}): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })

    const result = await response.json()
    return result.success === true
  } catch (e) {
    console.error('[DingTalk] 发送工作通知失败:', e)
    return false
  }
}

// ==================== 机器人消息（直接Webhook） ====================

/** 通过群机器人Webhook发送消息 */
export async function sendRobotMessage(
  content: string,
  atAll: boolean = false
): Promise<boolean> {
  if (!DINGTALK_ROBOT_WEBHOOK) {
    console.warn('[DingTalk] 机器人Webhook未配置')
    return false
  }

  try {
    const response = await fetch(DINGTALK_ROBOT_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        msgtype: 'text',
        text: { content },
        at: { isAtAll: atAll },
      }),
    })
    const data = await response.json()
    return data.errcode === 0
  } catch (e) {
    console.error('[DingTalk] 发送机器人消息失败:', e)
    return false
  }
}

// ==================== 在线表格（通过服务端API） ====================

/** 读取表格数据 */
export async function fetchSheetData(sheetId: string, range: string): Promise<string[][] | null> {
  try {
    const response = await fetch(`${API_BASE}/sheet?sheetId=${encodeURIComponent(sheetId)}&range=${encodeURIComponent(range)}`)
    const result = await response.json()

    if (result.success && result.data) {
      return result.data.values || null
    }
    return null
  } catch (e) {
    console.error('[DingTalk] 读取表格数据失败:', e)
    return null
  }
}

/** 追加行到表格 */
export async function appendSheetData(sheetId: string, values: string[][]): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/sheet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sheetId, values }),
    })

    const result = await response.json()
    return result.success === true
  } catch (e) {
    console.error('[DingTalk] 追加表格数据失败:', e)
    return false
  }
}

/** 更新表格数据 */
export async function updateSheetData(
  sheetId: string,
  range: string,
  values: string[][]
): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/sheet`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sheetId, range, values }),
    })

    const result = await response.json()
    return result.success === true
  } catch (e) {
    console.error('[DingTalk] 更新表格数据失败:', e)
    return false
  }
}

// ==================== OA审批（通过服务端API） ====================

/** 发起审批实例 */
export async function createApproval(params: {
  processCode: string
  originatorUserId: string
  formComponentValues: { name: string; value: string }[]
  deptId?: number
  approverList?: { userId: string }[][]
}): Promise<string | null> {
  try {
    const response = await fetch(`${API_BASE}/approval`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })

    const result = await response.json()

    if (result.success && result.data) {
      return result.data.instanceId
    }
    return null
  } catch (e) {
    console.error('[DingTalk] 发起审批失败:', e)
    return null
  }
}

/** 查询审批实例状态 */
export async function getApprovalStatus(instanceId: string): Promise<any> {
  try {
    const response = await fetch(`${API_BASE}/approval?instanceId=${encodeURIComponent(instanceId)}`)
    const result = await response.json()

    if (result.success && result.data) {
      return result.data
    }
    return null
  } catch (e) {
    console.error('[DingTalk] 查询审批状态失败:', e)
    return null
  }
}

/** 获取审批模板列表 */
export async function getApprovalTemplates(): Promise<any[]> {
  try {
    const response = await fetch(`${API_BASE}/approval?action=templates`)
    const result = await response.json()

    if (result.success && result.data) {
      return result.data
    }
    return []
  } catch (e) {
    console.error('[DingTalk] 获取审批模板失败:', e)
    return []
  }
}

// ==================== 待办任务 ====================

/** 创建待办任务（服务端API方式） */
export async function createTodoTask(params: {
  userid: string
  title: string
  url: string
  deadline?: number
  formItemList?: { title: string; content: string }[]
}): Promise<string | null> {
  try {
    const response = await fetch(`${API_BASE}/todo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })

    const result = await response.json()

    if (result.success && result.data) {
      return result.data.record_id
    }
    return null
  } catch (e) {
    console.error('[DingTalk] 创建待办失败:', e)
    return null
  }
}

/** 完成待办任务（服务端API方式） */
export async function completeTodoTask(recordId: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/todo`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recordId }),
    })

    const result = await response.json()
    return result.success === true
  } catch (e) {
    console.error('[DingTalk] 完成待办失败:', e)
    return false
  }
}

// ==================== 通讯录（JSAPI方式） ====================

/** 弹出钉钉通讯录选择器 */
export async function pickContact(): Promise<any> {
  if (!isDingTalkEnv()) {
    return { name: '测试用户', userid: 'mock_user_id' }
  }

  try {
    const dd = (window as any).dd
    return new Promise((resolve, reject) => {
      dd.ready(() => {
        dd.biz.contact.complexPicker({
          title: '选择人员',
          multiple: false,
          limitTips: '最多选择1人',
          maxUsers: 1,
          pickedUsers: [],
          disabledUsers: [],
          requiredUsers: [],
          corpId: DINGTALK_CORP_ID,
          onSuccess: (result: any) => resolve(result),
          onFail: (err: any) => reject(err),
        })
      })
    })
  } catch (e) {
    console.error('[DingTalk] 选择联系人失败:', e)
    return null
  }
}
