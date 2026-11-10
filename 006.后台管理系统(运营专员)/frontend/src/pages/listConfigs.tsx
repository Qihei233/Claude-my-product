import {
  getDailyQuestions,
  getDailyStats,
  getFavorites,
  getMastery,
  getMessages,
  getProgress,
  getRecommendations,
  getRecords,
  getReports,
  getSubmissions,
} from '@/api/admin'
import type { AnyRow, ListResult } from '@/api/types'
import { StatusBadge } from '@/components/Badge'
import type { ListConfig } from '@/pages/ListPage'
import {
  difficultyLabel,
  formatDate,
  formatDateTime,
  statusLabels,
  text,
} from '@/utils/format'

const asRows = <T,>(promise: Promise<ListResult<T>>) =>
  promise as unknown as Promise<ListResult<AnyRow>>

export const listConfigs: Record<string, ListConfig> = {
  records: {
    title: '学习记录',
    subtitle: '用户课时完成与练习结果',
    keywordPlaceholder: '搜索用户 / 课时 / 题目',
    fetcher: (params) => asRows(getRecords(params)),
    exportType: 'records',
    filters: [
      {
        name: 'type',
        label: '类型',
        options: [
          { value: 'lesson', label: '课程' },
          { value: 'question', label: '练习' },
        ],
      },
    ],
    columns: [
      { key: 'nickname', label: '用户' },
      {
        key: 'type',
        label: '类型',
        render: (row) => statusLabels[String(row.type)] || text(row.type),
      },
      { key: 'title', label: '内容' },
      { key: 'detail', label: '详情' },
      { key: 'result', label: '结果', render: (row) => <StatusBadge value={row.result} /> },
      { key: 'minutes', label: '时长(分钟)', align: 'right' },
      { key: 'createdAt', label: '时间', render: (row) => formatDateTime(row.createdAt) },
    ],
  },
  submissions: {
    title: '提交记录',
    subtitle: '题目提交、测试用例通过情况与耗时',
    keywordPlaceholder: '搜索用户 / 题目',
    fetcher: (params) => asRows(getSubmissions(params)),
    exportType: 'submissions',
    filters: [
      {
        name: 'result',
        label: '结果',
        options: [
          { value: 'accepted', label: '通过' },
          { value: 'failed', label: '未通过' },
          { value: 'partial', label: '部分通过' },
          { value: 'timeout', label: '超时' },
          { value: 'error', label: '运行错误' },
        ],
      },
    ],
    columns: [
      { key: 'nickname', label: '用户' },
      {
        key: 'question',
        label: '题目',
        render: (row) => `${row.questionCode} ${row.questionTitle}`,
      },
      { key: 'result', label: '结果', render: (row) => <StatusBadge value={row.result} /> },
      {
        key: 'cases',
        label: '用例',
        render: (row) => `${row.passedCases}/${row.totalCases}`,
      },
      { key: 'runtimeMs', label: '耗时(ms)', align: 'right' },
      { key: 'attemptNo', label: '第几次', align: 'center' },
      {
        key: 'firstPass',
        label: '首次通过',
        render: (row) => (row.firstPass ? '是' : '否'),
      },
      { key: 'submittedAt', label: '提交时间', render: (row) => formatDateTime(row.submittedAt) },
    ],
  },
  progress: {
    title: '课时进度',
    subtitle: '用户各课时的学习状态与进度',
    keywordPlaceholder: '搜索用户 / 课时 / 课程',
    fetcher: (params) => asRows(getProgress(params)),
    filters: [
      {
        name: 'status',
        label: '状态',
        options: [
          { value: 'completed', label: '已完成' },
          { value: 'in_progress', label: '进行中' },
          { value: 'unlocked', label: '已解锁' },
          { value: 'locked', label: '未解锁' },
        ],
      },
    ],
    columns: [
      { key: 'nickname', label: '用户' },
      { key: 'courseTitle', label: '课程' },
      { key: 'lessonTitle', label: '课时' },
      { key: 'status', label: '状态', render: (row) => <StatusBadge value={row.status} /> },
      { key: 'progress', label: '进度', align: 'right', render: (row) => `${row.progress}%` },
      { key: 'updatedAt', label: '更新时间', render: (row) => formatDateTime(row.updatedAt) },
    ],
  },
  'daily-stats': {
    title: '每日统计',
    subtitle: '用户每天的学习时长、练习与经验',
    keywordPlaceholder: '搜索用户',
    fetcher: (params) => asRows(getDailyStats(params)),
    columns: [
      { key: 'nickname', label: '用户' },
      { key: 'date', label: '日期', render: (row) => formatDate(row.date) },
      { key: 'studyMinutes', label: '学习分钟', align: 'right' },
      { key: 'lessonsCompleted', label: '完成课时', align: 'right' },
      { key: 'questionsAttempted', label: '尝试题目', align: 'right' },
      { key: 'questionsPassed', label: '通过题目', align: 'right' },
      { key: 'expEarned', label: '获得经验', align: 'right' },
      { key: 'streakDays', label: '连续天数', align: 'right' },
    ],
  },
  mastery: {
    title: '知识点掌握度',
    subtitle: '来自 mastery_scores 的掌握度数据',
    keywordPlaceholder: '搜索用户 / 知识点',
    fetcher: (params) => asRows(getMastery(params)),
    columns: [
      { key: 'nickname', label: '用户' },
      { key: 'knowledgePoint', label: '知识点' },
      {
        key: 'score',
        label: '掌握度',
        align: 'right',
        render: (row) => `${Math.round(Number(row.score) * 100)}%`,
      },
      { key: 'attempts', label: '尝试', align: 'right' },
      { key: 'correctCount', label: '正确', align: 'right' },
      {
        key: 'targetDifficulty',
        label: '目标难度',
        align: 'center',
        render: (row) => difficultyLabel(row.targetDifficulty),
      },
    ],
  },
  messages: {
    title: '消息',
    subtitle: '站内消息与已读状态',
    keywordPlaceholder: '搜索用户 / 标题',
    fetcher: (params) => asRows(getMessages(params)),
    filters: [
      {
        name: 'type',
        label: '类型',
        options: [
          { value: 'system', label: '系统' },
          { value: 'reminder', label: '提醒' },
          { value: 'achievement', label: '成就' },
        ],
      },
    ],
    columns: [
      { key: 'nickname', label: '用户' },
      { key: 'title', label: '标题' },
      { key: 'content', label: '内容' },
      {
        key: 'type',
        label: '类型',
        render: (row) => statusLabels[String(row.type)] || text(row.type),
      },
      { key: 'read', label: '已读', render: (row) => (row.read ? '是' : '否') },
      { key: 'createdAt', label: '时间', render: (row) => formatDateTime(row.createdAt) },
    ],
  },
  favorites: {
    title: '收藏',
    subtitle: '用户收藏的课程与题目',
    keywordPlaceholder: '搜索用户',
    fetcher: (params) => asRows(getFavorites(params)),
    columns: [
      { key: 'nickname', label: '用户' },
      {
        key: 'targetType',
        label: '类型',
        render: (row) => statusLabels[String(row.targetType)] || text(row.targetType),
      },
      { key: 'targetTitle', label: '内容' },
      { key: 'createdAt', label: '收藏时间', render: (row) => formatDateTime(row.createdAt) },
    ],
  },
  recommendations: {
    title: '学习推荐',
    subtitle: '系统生成的个性化推荐',
    keywordPlaceholder: '搜索用户',
    fetcher: (params) => asRows(getRecommendations(params)),
    columns: [
      { key: 'nickname', label: '用户' },
      { key: 'type', label: '类型' },
      { key: 'target', label: '推荐内容' },
      { key: 'reason', label: '原因' },
      { key: 'priority', label: '优先级', align: 'center' },
      { key: 'status', label: '状态', render: (row) => <StatusBadge value={row.status} /> },
      { key: 'createdAt', label: '创建时间', render: (row) => formatDateTime(row.createdAt) },
    ],
  },
  reports: {
    title: '学习报告',
    subtitle: '周期性学习报告',
    keywordPlaceholder: '搜索用户',
    fetcher: (params) => asRows(getReports(params)),
    columns: [
      { key: 'nickname', label: '用户' },
      { key: 'periodType', label: '周期' },
      { key: 'period', label: '日期范围' },
      { key: 'studyMinutes', label: '学习分钟', align: 'right' },
      { key: 'lessonsCompleted', label: '完成课时', align: 'right' },
      { key: 'accuracy', label: '正确率', align: 'right', render: (row) => `${row.accuracy}%` },
      { key: 'generatedAt', label: '生成时间', render: (row) => formatDateTime(row.generatedAt) },
    ],
  },
  'daily-questions': {
    title: '每日一题',
    subtitle: '每日推荐题目记录',
    keywordPlaceholder: '搜索关键词',
    fetcher: (params) => asRows(getDailyQuestions(params)),
    columns: [
      { key: 'date', label: '日期', render: (row) => formatDate(row.date) },
      { key: 'questionCode', label: '题目编码' },
      { key: 'title', label: '题目' },
      { key: 'difficulty', label: '难度', render: (row) => difficultyLabel(row.difficulty) },
      { key: 'status', label: '状态', render: (row) => <StatusBadge value={row.status} /> },
    ],
  },
}
