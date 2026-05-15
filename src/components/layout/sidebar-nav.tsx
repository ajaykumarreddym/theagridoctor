'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Trees, Sprout, Cloud, LayoutDashboard, MessageCircle, BarChart3, Users, History, Settings, X, Bell } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'AI Diagnosis', href: '/diagnose', icon: Sprout },
  { name: 'Diagnosis History', href: '/diagnose/history', icon: History },
  { name: 'AI Advisor', href: '/advisor', icon: MessageCircle },
  { name: 'Farm Management', href: '/farms', icon: Trees },
  { name: 'Weather', href: '/weather', icon: Cloud },
  { name: 'Market Prices', href: '/market', icon: BarChart3 },
  { name: 'Community', href: '/community', icon: Users },
  { name: 'Alerts', href: '/alerts', icon: Bell },
  { name: 'Profile', href: '/profile', icon: Settings },
]

export function SidebarNav({
  profile,
  mobile = false,
  onClose,
}: {
  profile: { name: string; email: string; initials: string }
  mobile?: boolean
  onClose?: () => void
}) {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <aside
      className={cn(
        'w-64 bg-white border-r border-slate-200 flex flex-col h-full',
        !mobile && 'fixed inset-y-0 left-0 z-10 hidden md:flex'
      )}
    >
      <div className="p-6 flex items-center justify-between border-b border-slate-100">
        <Link href="/" className="flex items-center space-x-2" onClick={onClose}>
          <div className="w-8 h-8 rounded bg-emerald-600 flex items-center justify-center">
            <Sprout className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-slate-800 tracking-tight">AgriDoctor</span>
        </Link>
        {mobile && (
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center"
            aria-label="Close menu"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        )}
      </div>

      <div className="flex-1 py-6 px-4 space-y-1.5 overflow-y-auto">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 px-2">Menu</div>
        {navItems.map((item) => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                'flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'text-slate-600 hover:text-emerald-700 hover:bg-emerald-50'
              )}
            >
              <item.icon className="w-5 h-5" />
              <span>{item.name}</span>
            </Link>
          )
        })}
      </div>

      <div className="p-4 border-t border-slate-200 bg-slate-50">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-800 font-bold uppercase">
            {profile.initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-800 truncate">{profile.name}</p>
            <p className="text-xs text-slate-500 truncate">{profile.email}</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
