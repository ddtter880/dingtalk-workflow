/**
 * 周期工具函数
 * 处理周次计算、状态自动切换判断
 */

// 获取当前周次标识 (如 2026-W17)
export function getCurrentWeek(): string {
  const now = new Date()
  const startOfYear = new Date(now.getFullYear(), 0, 1)
  const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000)) + 1
  const weekNumber = Math.ceil(dayOfYear / 7)
  return `${now.getFullYear()}-W${weekNumber.toString().padStart(2, '0')}`
}

// 获取本周的起止日期
export function getWeekRange(): { start: Date; end: Date } {
  const now = new Date()
  const day = now.getDay() || 7 // 周日=7
  const start = new Date(now)
  start.setDate(now.getDate() - day + 1)
  start.setHours(0, 0, 0, 0)

  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)

  return { start, end }
}

// 判断项目是否应该从"新增"转为"待处理"
export function shouldConvertToProcessing(createdWeek: string): boolean {
  const currentWeek = getCurrentWeek()
  return createdWeek !== currentWeek
}

// 格式化日期
export function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  try {
    const date = new Date(dateStr)
    return `${date.getFullYear()}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`
  } catch {
    return dateStr
  }
}

// 格式化日期时间
export function formatDateTime(dateStr: string): string {
  if (!dateStr) return ''
  try {
    const date = new Date(dateStr)
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    return `${month}/${day} ${hours}:${minutes}`
  } catch {
    return dateStr
  }
}

// 计算距离截止日期的天数
export function daysUntilDeadline(deadline: string): number {
  if (!deadline) return Infinity
  const target = new Date(deadline)
  const now = new Date()
  const diff = target.getTime() - now.getTime()
  return Math.ceil(diff / (24 * 60 * 60 * 1000))
}

// 截止日期状态
export function getDeadlineStatus(deadline: string): 'overdue' | 'urgent' | 'normal' | 'none' {
  if (!deadline) return 'none'
  const days = daysUntilDeadline(deadline)
  if (days < 0) return 'overdue'
  if (days <= 3) return 'urgent'
  return 'normal'
}
