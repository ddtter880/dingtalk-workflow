/**
 * JSAPI 鉴权签名接口
 * GET /api/jsapi/signature?url=xxx
 * 返回 dd.config 所需的签名参数
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { generateJsapiSignature } from '../_lib/dingtalk.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { url } = req.query as { url?: string }

    if (!url) {
      return res.status(400).json({ error: '缺少url参数' })
    }

    const signData = await generateJsapiSignature(url)

    return res.status(200).json({
      success: true,
      data: signData,
    })
  } catch (error: any) {
    console.error('[API] JSAPI签名失败:', error)
    return res.status(500).json({
      success: false,
      error: error.message || '签名生成失败',
    })
  }
}
