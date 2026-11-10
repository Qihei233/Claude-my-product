import { cn } from '@/utils/cn'

interface AvatarProps {
  initial?: string
  image?: string | null
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  tone?: 'yellow' | 'cream'
}

export function Avatar({
  initial = '蛙',
  image,
  size = 'md',
  className,
  tone = 'yellow',
}: AvatarProps) {
  return (
    <span
      className={cn(
        'avatar',
        `avatar-${size}`,
        `avatar-${tone}`,
        image && 'avatar-with-image',
        className,
      )}
      aria-hidden="true"
    >
      {image ? <img src={image} alt="" /> : initial.slice(0, 1)}
    </span>
  )
}
