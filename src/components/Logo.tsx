interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export default function Logo({ size = 'md', className = '' }: LogoProps) {
  const sizes = {
    sm: 'h-10 w-auto',
    md: 'h-12 w-auto',
    lg: 'h-16 w-auto',
  }
  const s = sizes[size]

  return (
    <div className={`flex items-center ${className}`}>
      <img
        src="/brand/lifeexpanse-logo.png"
        alt="LifeExpanse"
        className={`${s} shrink-0 object-contain object-left`}
      />
    </div>
  )
}
