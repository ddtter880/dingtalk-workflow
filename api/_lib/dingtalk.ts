/**
 * 钉钉API服务端工具库
 * 处理access_token获取、缓存、以及所有需要appSecret的API调用
 * 部署为Vercel Serverless Functions
 */

// ==================== 类型定义 ====================

interface TokenCache {
  accessToken: string
  expireAt: number // Unix timestamp (ms)
}

interface DingTalkUser {
  userid: string
  unionid?: string
  name: string
  avatar?: string
  mobile?: string
  dept_id_list?: number[]
  title?: string
}

interface ApprovalFormData {
  name: string
  value: string
}

// ==================== 环境变量 ====================

function getAppKey(): string {
  return process.env.DINGTALK_APP_KEY || ''
}

function getAppSecret(): string {
  return process.env.DINGTALK_APP_SECRET || ''
}

function getCorpId(): string {
  return process.env.DINGTALK_CORP_ID || ''
}

function getAgentId(): string {
  return process.env.DINGTALK_AGENT_ID || ''
}

// ==================== Access Token 管理 ====================

// 内存缓存（Serverless Function实例内有效）
let tokenCache: TokenCache | null = null

/**
 * 获取企业内部应用的 access_token
 * 新版API: POST https://api.dingtalk.com/v1.0/oauth2/accessToken
 */
export async function getAccessToken(): Promise<string> {
  // 检查缓存
  if (tokenCache && tokenCache.expireAt > Date.now()) {
    return tokenCache.accessToken
  }

  const appKey = getAppKey()
  const appSecret = getAppSecret()

  if (!appKey || !appSecret) {
    throw new Error('缺少钉钉应用凭证：DINGTALK_APP_KEY 或 DINGTALK_APP_SECRET 未配置')
  }

  try {
    const response = await fetch('https://api.dingtalk.com/v1.0/oauth2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appKey,
        appSecret,
      }),
    })

    const data = await response.json()

    if (!data.accessToken) {
      throw new Error(`获取access_token失败: ${JSON.stringify(data)}`)
    }

    // 缓存token，提前5分钟过期以避免边界情况
    tokenCache = {
      accessToken: data.accessToken,
      expireAt: Date.now() + (data.expireIn - 300) * 1000,
    }

    return data.accessToken
  } catch (error) {
    console.error('[DingTalk] 获取access_token失败:', error)
    throw error
  }
}

// ==================== OAuth 免登 ====================

/**
 * 通过authCode获取用户userid
 * 旧版API: POST https://oapi.dingtalk.com/topapi/v2/user/getuserinfo
 */
export async function getUserInfoByAuthCode(authCode: string): Promise<{ userid: string }> {
  const accessToken = await getAccessToken()

  const response = await fetch(
    `https://oapi.dingtalk.com/topapi/v2/user/getuserinfo?access_token=${accessToken}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: authCode }),
    }
  )

  const data = await response.json()

  if (data.errcode !== 0) {
    throw new Error(`获取用户信息失败: ${data.errmsg}`)
  }

  return {
    userid: data.result.userid,
  }
}

/**
 * 通过userid获取用户详细信息
 * 旧版API: POST https://oapi.dingtalk.com/topapi/v2/user/get
 */
export async function getUserDetail(userid: string): Promise<DingTalkUser> {
  const accessToken = await getAccessToken()

  const response = await fetch(
    `https://oapi.dingtalk.com/topapi/v2/user/get?access_token=${accessToken}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userid }),
    }
  )

  const data = await response.json()

  if (data.errcode !== 0) {
    throw new Error(`获取用户详情失败: ${data.errmsg}`)
  }

  return {
    userid: data.result.userid,
    unionid: data.result.unionid,
    name: data.result.name,
    avatar: data.result.avatar,
    mobile: data.result.mobile,
    dept_id_list: data.result.dept_id_list,
    title: data.result.title,
  }
}

// ==================== 通讯录 ====================

/**
 * 获取部门用户列表
 * POST https://oapi.dingtalk.com/topapi/v2/user/list
 */
export async function getDepartmentUsers(deptId: number, cursor: number = 0, size: number = 100) {
  const accessToken = await getAccessToken()

  const response = await fetch(
    `https://oapi.dingtalk.com/topapi/v2/user/list?access_token=${accessToken}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dept_id: deptId, cursor, size }),
    }
  )

  return response.json()
}

// ==================== 工作通知消息 ====================

/**
 * 发送工作通知消息
 * POST https://oapi.dingtalk.com/topapi/message/corpconversation/asyncsend_v2
 */
export async function sendWorkNotification(params: {
  userid_list: string
  msg: {
    msgtype: string
    text?: { content: string }
    markdown?: { title: string; text: string }
    oa?: any
  }
}): Promise<{ task_id: number }> {
  const accessToken = await getAccessToken()
  const agentId = getAgentId()

  const response = await fetch(
    `https://oapi.dingtalk.com/topapi/message/corpconversation/asyncsend_v2?access_token=${accessToken}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: agentId,
        userid_list: params.userid_list,
        ...params.msg,
      }),
    }
  )

  const data = await response.json()

  if (data.errcode !== 0) {
    throw new Error(`发送工作通知失败: ${data.errmsg}`)
  }

  return { task_id: data.task_id }
}

// ==================== OA审批 ====================

/**
 * 发起审批实例
 * 新版API: POST https://api.dingtalk.com/v1.0/workflow/processInstances
 */
export async function createApprovalInstance(params: {
  processCode: string
  originatorUserId: string
  formComponentValues: ApprovalFormData[]
  deptId?: number
  approverList?: { userId: string }[][]
}): Promise<{ instanceId: string }> {
  const accessToken = await getAccessToken()

  const body: any = {
    processCode: params.processCode,
    originatorUserId: params.originatorUserId,
    formComponentValues: params.formComponentValues,
  }

  if (params.deptId) body.deptId = params.deptId
  if (params.approverList) body.approverList = params.approverList

  const response = await fetch(
    'https://api.dingtalk.com/v1.0/workflow/processInstances',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-acs-dingtalk-access-token': accessToken,
      },
      body: JSON.stringify(body),
    }
  )

  const data = await response.json()

  if (!data.instanceId) {
    throw new Error(`发起审批失败: ${JSON.stringify(data)}`)
  }

  return { instanceId: data.instanceId }
}

/**
 * 获取审批实例详情
 * GET https://api.dingtalk.com/v1.0/workflow/processInstances/{instanceId}
 */
export async function getApprovalInstance(instanceId: string) {
  const accessToken = await getAccessToken()

  const response = await fetch(
    `https://api.dingtalk.com/v1.0/workflow/processInstances/${instanceId}`,
    {
      method: 'GET',
      headers: {
        'x-acs-dingtalk-access-token': accessToken,
      },
    }
  )

  return response.json()
}

/**
 * 获取审批模板列表
 * POST https://api.dingtalk.com/v1.0/workflow/processes
 */
export async function getApprovalTemplates() {
  const accessToken = await getAccessToken()

  const response = await fetch(
    'https://api.dingtalk.com/v1.0/workflow/processes',
    {
      method: 'GET',
      headers: {
        'x-acs-dingtalk-access-token': accessToken,
      },
    }
  )

  return response.json()
}

// ==================== 在线表格 ====================
// 正确API路径: /v1.0/doc/workbooks/{workbookId}/sheets/{sheetId}/...

/**
 * 获取电子表格所有工作表
 * GET /v1.0/doc/workbooks/{workbookId}/sheets
 */
export async function getSpreadsheetSheets(spreadsheetId: string) {
  const accessToken = await getAccessToken()

  const response = await fetch(
    `https://api.dingtalk.com/v1.0/doc/workbooks/${spreadsheetId}/sheets`,
    {
      method: 'GET',
      headers: {
        'x-acs-dingtalk-access-token': accessToken,
      },
    }
  )

  return response.json()
}

/**
 * 获取电子表格单元格区域数据
 * GET /v1.0/doc/workbooks/{workbookId}/sheets/{sheetId}/ranges/{rangeAddress}
 * 返回 { values: string[][], formulas: string[][], displayValues: string[][] }
 */
export async function getSpreadsheetRange(
  spreadsheetId: string,
  sheetId: string,
  range: string,
  operatorId?: string
) {
  const accessToken = await getAccessToken()

  let url = `https://api.dingtalk.com/v1.0/doc/workbooks/${spreadsheetId}/sheets/${sheetId}/ranges/${range}?select=values`
  if (operatorId) {
    url += `&operatorId=${encodeURIComponent(operatorId)}`
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'x-acs-dingtalk-access-token': accessToken,
    },
  })

  return response.json()
}

/**
 * 更新电子表格单元格区域数据
 * PUT /v1.0/doc/workbooks/{workbookId}/sheets/{sheetId}/ranges/{rangeAddress}
 */
export async function updateSpreadsheetRange(
  spreadsheetId: string,
  sheetId: string,
  range: string,
  values: string[][],
  operatorId?: string
) {
  const accessToken = await getAccessToken()

  let url = `https://api.dingtalk.com/v1.0/doc/workbooks/${spreadsheetId}/sheets/${sheetId}/ranges/${range}`
  if (operatorId) {
    url += `?operatorId=${encodeURIComponent(operatorId)}`
  }

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'x-acs-dingtalk-access-token': accessToken,
    },
    body: JSON.stringify({ values }),
  })

  return response.json()
}

/**
 * 追加行到电子表格
 * POST /v1.0/doc/workbooks/{workbookId}/sheets/{sheetId}/appendRows
 */
export async function appendSpreadsheetRows(
  spreadsheetId: string,
  sheetId: string,
  values: string[][],
  operatorId?: string
) {
  const accessToken = await getAccessToken()

  let url = `https://api.dingtalk.com/v1.0/doc/workbooks/${spreadsheetId}/sheets/${sheetId}/appendRows`
  if (operatorId) {
    url += `?operatorId=${encodeURIComponent(operatorId)}`
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-acs-dingtalk-access-token': accessToken,
    },
    body: JSON.stringify({ values }),
  })

  return response.json()
}

// ==================== 待办任务 ====================

/**
 * 创建待办任务
 * POST https://oapi.dingtalk.com/topapi/workrecord/create
 */
export async function createWorkRecord(params: {
  userid: string
  create_time: number
  title: string
  url: string
  pc_url?: string
  formItemList?: { title: string; content: string }[]
  deadline_time?: number
}) {
  const accessToken = await getAccessToken()

  const response = await fetch(
    `https://oapi.dingtalk.com/topapi/workrecord/create?access_token=${accessToken}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    }
  )

  return response.json()
}

/**
 * 完成待办任务
 * POST https://oapi.dingtalk.com/topapi/workrecord/update
 */
export async function completeWorkRecord(recordId: string) {
  const accessToken = await getAccessToken()

  const response = await fetch(
    `https://oapi.dingtalk.com/topapi/workrecord/update?access_token=${accessToken}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ record_id: recordId, status: 'COMPLETED' }),
    }
  )

  return response.json()
}

// ==================== JSAPI 签名 ====================

import { createHash, randomUUID } from 'node:crypto'

interface TicketCache {
  ticket: string
  expireAt: number
}

let jsapiTicketCache: TicketCache | null = null

/**
 * 获取 jsapi_ticket
 * GET https://oapi.dingtalk.com/getticket?access_token=ACCESS_TOKEN&type=jsapi
 */
export async function getJsapiTicket(): Promise<string> {
  // 检查缓存（ticket有效期7200秒，提前5分钟刷新）
  if (jsapiTicketCache && jsapiTicketCache.expireAt > Date.now()) {
    return jsapiTicketCache.ticket
  }

  const accessToken = await getAccessToken()

  const response = await fetch(
    `https://oapi.dingtalk.com/getticket?access_token=${accessToken}&type=jsapi`,
    { method: 'GET' }
  )

  const data = await response.json() as { errcode: number; errmsg: string; ticket: string; expires_in: number }

  if (data.errcode !== 0) {
    throw new Error(`获取jsapi_ticket失败: ${data.errmsg}`)
  }

  jsapiTicketCache = {
    ticket: data.ticket,
    expireAt: Date.now() + (data.expires_in - 300) * 1000,
  }

  return data.ticket
}

/**
 * 生成 JSAPI 鉴权签名
 * 签名算法：SHA1(jsapi_ticket=TICKET&noncestr=NONCESTR&timestamp=TIMESTAMP&url=URL)
 */
export async function generateJsapiSignature(url: string): Promise<{
  agentId: string
  corpId: string
  timeStamp: string
  nonceStr: string
  signature: string
}> {
  const ticket = await getJsapiTicket()
  const nonceStr = randomUUID().replace(/-/g, '')
  const timeStamp = Math.floor(Date.now() / 1000).toString()

  // 按字典序拼接：jsapi_ticket, noncestr, timestamp, url（key全小写）
  const signStr = `jsapi_ticket=${ticket}&noncestr=${nonceStr}&timestamp=${timeStamp}&url=${url}`
  const signature = createHash('sha1').update(signStr).digest('hex')

  return {
    agentId: getAgentId(),
    corpId: getCorpId(),
    timeStamp,
    nonceStr,
    signature,
  }
}
