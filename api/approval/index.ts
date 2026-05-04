/**
 * OA审批接口
 * POST /api/approval - 发起审批实例
 * GET /api/approval?instanceId=xxx - 查询审批详情
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  createApprovalInstance,
  getApprovalInstance,
  getApprovalTemplates,
} from '../_lib/dingtalk'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  try {
    switch (req.method) {
      case 'GET': {
        const { instanceId, action } = req.query as { instanceId?: string; action?: string }

        if (action === 'templates') {
          // 获取审批模板列表
          const data = await getApprovalTemplates()
          return res.status(200).json({ success: true, data })
        }

        if (instanceId) {
          // 查询审批实例详情
          const data = await getApprovalInstance(instanceId)
          return res.status(200).json({ success: true, data })
        }

        return res.status(400).json({ error: '缺少instanceId或action参数' })
      }

      case 'POST': {
        // 发起审批实例
        const { processCode, originatorUserId, formComponentValues, deptId, approverList } = req.body

        if (!processCode || !originatorUserId || !formComponentValues) {
          return res.status(400).json({ error: '缺少必要参数' })
        }

        const data = await createApprovalInstance({
          processCode,
          originatorUserId,
          formComponentValues,
          deptId,
          approverList,
        })

        return res.status(200).json({ success: true, data })
      }

      default:
        return res.status(405).json({ error: 'Method not allowed' })
    }
  } catch (error: any) {
    console.error('[API] 审批操作失败:', error)
    return res.status(500).json({
      success: false,
      error: error.message || '审批操作失败',
    })
  }
}
