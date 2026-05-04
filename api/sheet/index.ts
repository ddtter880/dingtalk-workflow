/**
 * 在线表格数据接口
 * GET /api/sheet?sheetId=xxx&range=A1:Z100&operatorId=xxx
 * POST /api/sheet (追加行) body: { sheetId, values, operatorId }
 * PUT /api/sheet (更新区域) body: { sheetId, range, values, operatorId }
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  getSpreadsheetRange,
  updateSpreadsheetRange,
  appendSpreadsheetRows,
} from '../_lib/dingtalk.js'

const SPREADSHEET_ID = process.env.DINGTALK_SHEET_ID || ''

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (!SPREADSHEET_ID) {
    return res.status(500).json({ error: '未配置DINGTALK_SHEET_ID' })
  }

  try {
    switch (req.method) {
      case 'GET': {
        // 读取表格数据
        const { sheetId, range, operatorId } = req.query as { sheetId?: string; range?: string; operatorId?: string }

        if (!sheetId || !range) {
          return res.status(400).json({ error: '缺少sheetId或range参数' })
        }

        const data = await getSpreadsheetRange(SPREADSHEET_ID, sheetId, range, operatorId)
        return res.status(200).json({ success: true, data })
      }

      case 'POST': {
        // 追加行
        const { sheetId, values, operatorId } = req.body

        if (!sheetId || !values) {
          return res.status(400).json({ error: '缺少sheetId或values参数' })
        }

        const data = await appendSpreadsheetRows(SPREADSHEET_ID, sheetId, values, operatorId)
        return res.status(200).json({ success: true, data })
      }

      case 'PUT': {
        // 更新区域
        const { sheetId, range, values, operatorId } = req.body

        if (!sheetId || !range || !values) {
          return res.status(400).json({ error: '缺少sheetId、range或values参数' })
        }

        const data = await updateSpreadsheetRange(SPREADSHEET_ID, sheetId, range, values, operatorId)
        return res.status(200).json({ success: true, data })
      }

      default:
        return res.status(405).json({ error: 'Method not allowed' })
    }
  } catch (error: any) {
    console.error('[API] 表格操作失败:', error)
    return res.status(500).json({
      success: false,
      error: error.message || '表格操作失败',
    })
  }
}
