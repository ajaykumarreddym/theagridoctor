import { Sidebar } from "@/components/layout/sidebar";
import { Navbar } from "@/components/layout/navbar";
import { requireUser } from "@/lib/auth";

function initialsOf(name: string, email: string) {
  const src = (name || email || '').trim()
  if (!src) return 'U'
  const parts = src.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return src.slice(0, 2).toUpperCase()
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, supabase } = await requireUser()
  const { data: profile } = await supabase
    .from('users')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle()

  const name = profile?.full_name || (user.user_metadata?.full_name as string | undefined) || user.email?.split('@')[0] || 'Farmer'
  const email = user.email || ''
  const profileInfo = { name, email, initials: initialsOf(name, email) }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar - fixed width on desktop */}
      <Sidebar profile={profileInfo} />
      
      {/* Main Content Area */}
      <div className="flex-1 md:ml-64 flex flex-col min-h-screen transition-all">
        <Navbar profile={profileInfo} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
