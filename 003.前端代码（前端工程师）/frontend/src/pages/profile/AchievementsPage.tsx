import { useEffect, useState } from 'react'
import { AchievementBadge } from '@/components/profile/AchievementBadge'
import { EmptyState } from '@/components/ui/EmptyState'
import { useAuth } from '@/app/AuthContext'
import { fetchAchievements } from '@/api/app'
import { getLevelInfo } from '@/data/mockData'
import type { Achievement } from '@/types'
import { cn } from '@/utils/cn'

type AchievementFilter = 'all' | 'earned' | 'locked'

function progressOf(achievement: Achievement, passedProblems: number, streak: number, level: number) {
  if (achievement.id === 'practice_50') return `当前 ${passedProblems} / 50 题`
  if (achievement.id === 'streak_30') return `当前连续 ${streak} / 30 天`
  if (achievement.id === 'frog_doctor') return `当前 Lv.${level}`
  return '继续学习即可解锁'
}

export function AchievementsPage() {
  const { user } = useAuth()
  const [filter, setFilter] = useState<AchievementFilter>('all')
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetchAchievements()
      .then((list) => {
        if (!cancelled) setAchievements(list)
      })
      .catch(() => {
        if (!cancelled) setAchievements([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user?.id])

  if (!user) return null

  const level = getLevelInfo(user.exp)
  const earnedCount = achievements.filter((achievement) => user.achievements[achievement.id]).length
  const lockedCount = achievements.length - earnedCount
  const filtered = achievements.filter((achievement) => {
    const earned = Boolean(user.achievements[achievement.id])
    if (filter === 'earned') return earned
    if (filter === 'locked') return !earned
    return true
  })

  return (
    <div className="profile-page">
      <header className="profile-page-heading">
        <h1>我的成就</h1>
        <p>认真尝试的你，值得一枚小小的勋章。</p>
      </header>

      <section className="achievement-banner">
        <img src="/frog/belly-laugh.png" alt="奶蛙为你的成就开心" />
        <div className="achievement-banner-copy">
          <h2>
            已点亮 <strong>{earnedCount}</strong> / {achievements.length} 枚成就
          </h2>
          <p>{loading ? '成就加载中…' : '还有新的小惊喜，在下一次坚持里等你。'}</p>
          <div className="achievement-filters" role="tablist" aria-label="成就筛选">
            <button
              type="button"
              role="tab"
              aria-selected={filter === 'all'}
              className={cn(filter === 'all' && 'is-active')}
              onClick={() => setFilter('all')}
            >
              全部成就
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filter === 'earned'}
              className={cn(filter === 'earned' && 'is-active')}
              onClick={() => setFilter('earned')}
            >
              已获得 {earnedCount}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filter === 'locked'}
              className={cn(filter === 'locked' && 'is-active')}
              onClick={() => setFilter('locked')}
            >
              未获得 {lockedCount}
            </button>
          </div>
        </div>
      </section>

      {filtered.length ? (
        <div className="achievement-grid">
          {filtered.map((achievement) => {
            const earnedAt = user.achievements[achievement.id]
            const unlocked = Boolean(earnedAt)
            return (
              <article
                key={achievement.id}
                className={cn('achievement-card', unlocked ? 'is-unlocked' : 'is-locked')}
              >
                <AchievementBadge icon={achievement.icon} unlocked={unlocked} size="lg" />
                <h3>{achievement.name}</h3>
                <p>{achievement.description}</p>
                <span className="achievement-state">
                  {unlocked ? `获得于 ${earnedAt}` : '尚未获得'}
                </span>
                {!unlocked && (
                  <span className="achievement-progress">
                    {progressOf(
                      achievement,
                      user.passedProblemCount,
                      user.streakDays,
                      level.level,
                    )}
                  </span>
                )}
              </article>
            )
          })}
        </div>
      ) : (
        <EmptyState
          image="/frog/lying-looking-up.png"
          title={loading ? '成就加载中…' : '这里暂时空空的'}
          description={
            loading
              ? '奶蛙正在整理你的勋章墙。'
              : filter === 'earned'
                ? '去完成第一节课，点亮属于你的第一枚勋章吧。'
                : '你已获得全部成就，奶蛙在下一段旅程等你。'
          }
        />
      )}
    </div>
  )
}
