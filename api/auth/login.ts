/**
 * OAuth免登接口
 * POST /api/auth/login
 * 接收前端传来的authCode，返回用户信息
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getUserInfoByAuthCode, getUserDetail } from '../_lib/dingtalk'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS处理
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
    const { authCode } = req.body

    if (!authCode) {
      return res.status(400).json({ error: '缺少authCode参数' })
    }

    // 第一步：用authCode换取userid
    const { userid } = await getUserInfoByAuthCode(authCode)

    // 第二步：用userid获取用户详情
    const userDetail = await getUserDetail(userid)

    return res.status(200).json({
      success: true,
      data: {
        userid: userDetail.userid,
        name: userDetail.name,
        avatar: userDetail.avatar,
        mobile: userDetail.mobile,
        title: userDetail.title,
        dept_id_list: userDetail.dept_id_list,
      },
    })
  } catch (error: any) {
    console.error('[API] OAuth登录失败:', error)
    return res.status(500).json({
      success: false,
      error: error.message || '登录失败',
    })
  }
}
