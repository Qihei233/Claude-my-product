export function formatDateTime(value: unknown) {
  if (value === null || value === undefined || value === '') return '-'
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('zh-CN', { hour12: false })
}

export function formatDate(value: unknown) {
  if (value === null || value === undefined || value === '') return '-'
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString('zh-CN')
}

export function text(value: unknown) {
  if (value === null || value === undefined || value === '') return '-'
  return String(value)
}

export function difficultyLabel(value: unknown) {
  if (typeof value === 'string') {
    const labels: Record<string, string> = {
      beginner: '入门',
      intermediate: '进阶',
      challenge: '挑战',
    }
    if (labels[value]) return labels[value]
  }
  const level = Number(value)
  if (!Number.isFinite(level)) return '-'
  if (level <= 2) return '入门'
  if (level === 3) return '进阶'
  return '挑战'
}

export function statusTone(value: unknown) {
  const status = String(value || '')
  if (['active', 'accepted', 'completed', 'passed', 'published'].includes(status)) {
    return 'green'
  }
  if (['failed', 'disabled', 'archived', 'draft'].includes(status)) {
    return 'red'
  }
  if (['partial', 'timeout', 'error', 'in_progress', 'learning', 'unlocked'].includes(status)) {
    return 'amber'
  }
  return 'gray'
}

export const statusLabels: Record<string, string> = {
  active: '正常',
  disabled: '已禁用',
  accepted: '通过',
  failed: '未通过',
  partial: '部分通过',
  timeout: '超时',
  error: '运行错误',
  completed: '已完成',
  in_progress: '进行中',
  unlocked: '已解锁',
  locked: '未解锁',
  learning: '学习中',
  published: '已发布',
  draft: '草稿',
  archived: '已归档',
  pending: '待处理',
  viewed: '已查看',
  expired: '已过期',
  lesson: '课程',
  question: '练习',
  course: '课程',
  review: '复习',
  system: '系统',
  reminder: '提醒',
  achievement: '成就',
}
