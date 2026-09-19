import { ReactNode, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { Radar, Search, Sparkles, Database, LayoutDashboard } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Shell({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [location]);

  const navItems = [
    { href: '/', label: 'Overview', icon: LayoutDashboard },
    { href: '/radar', label: 'Radar', icon: Radar },
    { href: '/copilot', label: 'Copilot', icon: Sparkles },
    { href: '/data', label: 'Data', icon: Database },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-50 w-full border-b bg-card/90 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2.5 text-primary font-bold hover:opacity-80 transition-opacity tracking-tight">
              <Radar className="h-5 w-5 text-razorpay" />
              <span>Business Radar</span>
            </Link>
            <nav className="hidden md:flex items-center gap-1.5">
              {navItems.map((item) => {
                const isActive = location === item.href || (item.href !== '/' && location.startsWith(item.href)) || (item.href === '/radar' && location.startsWith('/investigations'));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "px-3 py-1.5 text-sm font-medium rounded-sm transition-all flex items-center gap-2 relative",
                      isActive
                        ? "text-primary bg-secondary/80"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                    )}
                  >
                    <item.icon className={cn("h-4 w-4", isActive ? "text-razorpay" : "opacity-70")} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative hidden md:flex items-center">
              <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search signals, orders, payments..."
                className="h-9 w-64 rounded-sm border border-input bg-card pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono placeholder:font-sans transition-all focus:w-80"
              />
            </div>
            <div className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm shadow-sm cursor-pointer hover:opacity-90 transition-opacity">
              AC
            </div>
          </div>
        </div>
      </header>
      <main className="flex-1 container mx-auto px-4 py-8 max-w-[1400px]">
        {children}
      </main>
      
      <footer className="border-t py-10 mt-12 bg-card">
        <div className="container mx-auto px-4 max-w-[1400px] flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
          <div>
            <h3 className="font-bold text-lg text-foreground tracking-tight flex items-center gap-2">
              <Radar className="h-4 w-4 text-razorpay" />
              Business Radar
            </h3>
            <p className="text-sm text-muted-foreground mt-1 font-medium">Built for the Razorpay × Replit Hackathon</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-6 sm:gap-12 text-sm">
            <div className="flex items-start gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-razorpay mt-1 shadow-sm" />
              <div>
                <div className="font-bold uppercase tracking-wider text-foreground">Razorpay</div>
                <div className="text-muted-foreground text-xs mt-0.5">Payment infrastructure</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-replit mt-1 shadow-sm" />
              <div>
                <div className="font-bold uppercase tracking-wider text-foreground">Replit</div>
                <div className="text-muted-foreground text-xs mt-0.5">Built & prototyped on Replit</div>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}