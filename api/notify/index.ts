/**
 * 工作通知消息接口
 * POST /api/notify
 * 发送钉钉工作通知消息给指定用户
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sendWorkNotification } from '../_lib/dingtalk.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { userid_list, msgtype, content, title } = req.body

    if (!userid_list) {
      return res.status(400).json({ error: '缺少userid_list参数' })
    }

    let msg: any = {}

    switch (msgtype) {
      case 'text':
        msg = { msgtype: 'text', text: { content } }
        break
      case 'markdown':
        msg = { msgtype: 'markdown', markdown: { title: title || '通知', text: content } }
        break
      case 'oa':
        msg = { msgtype: 'oa', oa: content }
        break
      default:
        msg = { msgtype: 'text', text: { content } }
    }

    const result = await sendWorkNotification({ userid_list, msg })

    return res.status(200).json({
      success: true,
      data: result,
    })
  } catch (error: any) {
    console.error('[API] 发送通知失败:', error)
    return res.status(500).json({
      success: false,
      error: error.message || '发送通知失败',
    })
  }
}
