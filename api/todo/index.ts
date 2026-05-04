/**
 * 待办任务接口
 * POST /api/todo - 创建待办
 * PUT /api/todo - 完成待办
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createWorkRecord, completeWorkRecord } from '../_lib/dingtalk.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, PUT, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  try {
    switch (req.method) {
      case 'POST': {
        // 创建待办
        const { userid, title, url, deadline_time, formItemList } = req.body

        if (!userid || !title) {
          return res.status(400).json({ error: '缺少userid或title参数' })
        }

        const data = await createWorkRecord({
          userid,
          create_time: Date.now(),
          title,
          url: url || '',
          deadline_time,
          formItemList,
        })

        return res.status(200).json({ success: true, data })
      }

      case 'PUT': {
        // 完成待办
        const { recordId } = req.body

        if (!recordId) {
          return res.status(400).json({ error: '缺少recordId参数' })
        }

        const data = await completeWorkRecord(recordId)
        return res.status(200).json({ success: true, data })
      }

      default:
        return res.status(405).json({ error: 'Method not allowed' })
    }
  } catch (error: any) {
    console.error('[API] 待办操作失败:', error)
    return res.status(500).json({
      success: false,
      error: error.message || '待办操作失败',
    })
  }
}
