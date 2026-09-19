import { Link } from 'wouter';
import { useGetBusinessOverview, useListAnomalies, type Anomaly } from '@workspace/api-client-react';
import { Card, CardContent, Skeleton } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';
import { Sparkles, Banknote, Package, Users, Activity, ArrowRight, Upload, Target } from 'lucide-react';

export default function Overview() {
  const { data: overview, isLoading } = useGetBusinessOverview();
  const { data: crossSystemSignals, isLoading: isLoadingSignals } = useListAnomalies();
  const signals = overview?.signals ?? [];
  const countSignals = (terms: string[]) => signals.filter((signal) => {
    const searchable = `${signal.title} ${signal.summary} ${signal.systems.join(' ')}`.toLowerCase();
    return terms.some((term) => searchable.includes(term));
  }).length;
  const categoryCounts = {
    money: countSignals(['razorpay', 'payment', 'settlement', 'refund', 'cash', 'receivable']),
    inventory: countSignals(['inventory', 'product', 'stock', 'supplier']),
    customers: countSignals(['customer', 'support', 'complaint', 'refund']),
    operations: countSignals(['order', 'operation', 'expense', 'supplier', 'fulfillment']),
  };
  const categoryStatus = (count: number) => count === 0 ? 'Healthy' : `${count} ${count === 1 ? 'signal' : 'signals'}`;

  if (!isLoading && overview?.contextState === 'NO_CONTEXT') {
    return (
      <div className="space-y-8 animate-in fade-in duration-500 max-w-4xl mx-auto py-12">
        <div className="text-center space-y-4 mb-12">
          <h1 className="text-5xl font-bold tracking-tight text-foreground">Business Radar</h1>
          <p className="text-xl text-muted-foreground">See what your business needs next.</p>
        </div>
        <Card className="border-dashed border-2 shadow-none bg-card/50">
          <CardContent className="py-24 flex flex-col items-center text-center">
            <div className="h-16 w-16 bg-primary/5 rounded-full flex items-center justify-center mb-6">
              <Upload className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Bring your business into Business Radar.</h2>
            <p className="text-muted-foreground mt-3 mb-8 max-w-md">Connect your payment activity with orders, inventory, and operations to find the signals that individual systems miss.</p>
            <Link href="/data" className="inline-flex items-center gap-2 rounded-sm bg-primary px-6 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-all shadow-sm">
              Upload Excel workbook <ArrowRight className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-12 animate-in fade-in duration-500">
      
      {/* Hero Section */}
      <div className="py-6 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
        <div className="space-y-5 flex-1">
          <div className="inline-flex px-2.5 py-1 bg-primary text-primary-foreground text-[10px] font-bold tracking-widest rounded-sm uppercase shadow-sm">
            Business Radar
          </div>
          <h1 className="text-4xl lg:text-5xl font-bold tracking-tight text-foreground leading-tight">
            See what your business <br className="hidden lg:block"/>needs next.
          </h1>
        </div>
        
        <div className="bg-card border p-5 rounded-sm shadow-sm max-w-sm w-full relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-razorpay/5 to-transparent pointer-events-none" />
          <h3 className="text-xs font-bold uppercase tracking-wider mb-4 text-foreground relative z-10 flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-razorpay" />
            How it works
          </h3>
          <div className="space-y-3 text-sm relative z-10 font-medium text-muted-foreground">
            <div className="flex justify-between items-center">
              <span>Razorpay tells you where money moved</span>
              <ArrowRight className="w-3 h-3 opacity-50" />
            </div>
            <div className="flex justify-between items-center">
              <span>Business Radar connects the story</span>
              <ArrowRight className="w-3 h-3 opacity-50" />
            </div>
            <div className="pt-3 mt-3 border-t font-bold text-foreground flex justify-between items-center">
              <span>Find what needs attention</span>
              <Target className="w-4 h-4 text-replit" />
            </div>
          </div>
        </div>
      </div>

      {/* Category Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <CategoryCard 
          title="MONEY" 
          status={isLoading ? "Loading..." : categoryStatus(categoryCounts.money)}
          icon={<Banknote className="w-5 h-5 text-mint" />} 
          alert={categoryCounts.money > 0}
        />
        <CategoryCard 
          title="INVENTORY" 
          status={isLoading ? "Loading..." : categoryStatus(categoryCounts.inventory)}
          icon={<Package className="w-5 h-5 text-replit" />} 
          alert={categoryCounts.inventory > 0}
        />
        <CategoryCard 
          title="CUSTOMERS" 
          status={isLoading ? "Loading..." : categoryStatus(categoryCounts.customers)}
          icon={<Users className="w-5 h-5 text-violet" />} 
          alert={categoryCounts.customers > 0}
        />
        <CategoryCard 
          title="OPERATIONS" 
          status={isLoading ? "Loading..." : categoryStatus(categoryCounts.operations)}
          icon={<Activity className="w-5 h-5 text-blue" />} 
          alert={categoryCounts.operations > 0}
        />
      </div>

      {/* 3 Things You Wouldn't See */}
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b pb-4">
          <h2 className="text-xl font-bold tracking-tight">3 things you probably wouldn't see in one system</h2>
          <Link href="/radar" className="text-sm font-bold text-primary hover:text-primary/80 transition-colors flex items-center gap-1">
            View all signals <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {isLoading || isLoadingSignals ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="h-64 shadow-sm"><CardContent className="p-6"><Skeleton className="h-full w-full" /></CardContent></Card>
            ))
          ) : !crossSystemSignals || crossSystemSignals.length === 0 ? (
             <div className="col-span-3 py-16 text-center text-muted-foreground border rounded-sm bg-card/50">
               No priority signals detected. You're all clear.
             </div>
          ) : (
            <>
              {crossSystemSignals[0] && <InsightCard anomaly={crossSystemSignals[0]} theme="red" />}
              {crossSystemSignals[1] && <InsightCard anomaly={crossSystemSignals[1]} theme="orange" />}
              {crossSystemSignals[2] && <InsightCard anomaly={crossSystemSignals[2]} theme="violet" />}
            </>
          )}
        </div>
      </div>

      {/* Business Health & Copilot */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
           <h2 className="text-xl font-bold tracking-tight border-b pb-4">Business System Health</h2>
           {overview && (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <HealthModule title="RAZORPAY LAYER" metrics={overview.razorpayHealth} accent="bg-razorpay" />
               <HealthModule title="BUSINESS CONTEXT" metrics={overview.businessHealth} accent="bg-primary" />
             </div>
           )}
        </div>

        <div className="space-y-6">
          <h2 className="text-xl font-bold tracking-tight border-b pb-4">Decision Support</h2>
          <Card className="border shadow-sm bg-card relative overflow-hidden group h-[calc(100%-3.5rem)]">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
              <Sparkles className="w-24 h-24 text-primary" />
            </div>
            <CardContent className="p-6 relative z-10 flex flex-col h-full">
              <div className="h-10 w-10 rounded-sm bg-primary text-primary-foreground flex items-center justify-center mb-5 shadow-sm">
                <Sparkles className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-lg mb-2">Ask Business Copilot</h3>
              <p className="text-sm text-muted-foreground mb-8 font-medium">
                Ask evidence-grounded questions about your cross-system data. No generic advice, just direct answers based on your records.
              </p>
              
              <div className="mt-auto space-y-3">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Try asking</p>
                <div className="space-y-2">
                  <div className="text-xs bg-muted p-2.5 rounded-sm font-mono text-foreground border border-border/50 shadow-sm">
                    "Can I afford ₹3L of inventory?"
                  </div>
                  <div className="text-xs bg-muted p-2.5 rounded-sm font-mono text-foreground border border-border/50 shadow-sm">
                    "Which products could run out?"
                  </div>
                </div>
                <Link href="/copilot" className="w-full mt-4 flex justify-center items-center gap-2 rounded-sm bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm">
                  Open Copilot
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function CategoryCard({ title, status, icon, alert = false }: { title: string, status: string, icon: React.ReactNode, alert?: boolean }) {
  return (
    <div className={`p-4 rounded-sm border shadow-sm flex items-center gap-4 bg-card ${alert ? 'border-destructive/30' : ''}`}>
      <div className={`p-2.5 rounded-sm shrink-0 shadow-sm ${alert ? 'bg-destructive/10' : 'bg-muted'}`}>
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{title}</p>
        <p className={`font-semibold mt-0.5 ${alert ? 'text-destructive' : 'text-foreground'}`}>{status}</p>
      </div>
    </div>
  );
}

function InsightCard({ anomaly, theme }: { anomaly: Anomaly, theme: 'red' | 'orange' | 'violet' }) {
  const themes = {
    red: { bg: 'bg-razorpay/5', border: 'border-razorpay/20', text: 'text-razorpay', indicator: 'bg-razorpay' },
    orange: { bg: 'bg-replit/5', border: 'border-replit/20', text: 'text-replit', indicator: 'bg-replit' },
    violet: { bg: 'bg-violet/5', border: 'border-violet/20', text: 'text-violet', indicator: 'bg-violet' },
  };
  const t = themes[theme];
  const displayTitle = anomaly.id === 'orphan-settlements'
    ? `${formatCurrency(anomaly.impactAmount)} in settlements cannot be matched`
    : anomaly.title;

  // Friendly impact statement mapping based on type or title
  // In a real app we'd get this friendly string from the API, but we'll try to present the title/summary in a friendly way if possible.
  
  return (
    <Card className={`border shadow-sm flex flex-col relative overflow-hidden transition-all hover:shadow-md ${t.border}`}>
      <div className={`absolute top-0 left-0 w-full h-1 ${t.indicator}`} />
      <CardContent className={`p-6 flex flex-col h-full bg-card`}>
        
        <div className="mb-4 flex items-start justify-between gap-4">
          <h3 className="font-bold text-lg leading-snug text-foreground">
            {displayTitle}
          </h3>
        </div>
        
        <p className="text-sm text-muted-foreground font-medium mb-6 flex-1">
          {anomaly.summary}
        </p>
        
        <div className="mt-auto space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {anomaly.systems.map(sys => (
              <span key={sys} className="text-[10px] uppercase font-bold tracking-widest bg-muted px-2 py-1 rounded-sm text-muted-foreground">
                {sys}
              </span>
            ))}
          </div>
          <Link href={`/investigations/${anomaly.id}`} className={`inline-flex items-center gap-1.5 text-sm font-bold ${t.text} hover:underline`}>
            Investigate this <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function HealthModule({ title, metrics, accent }: { title: string; metrics: { label: string; value: string }[], accent: string }) {
  return (
    <Card className="border shadow-sm bg-card relative overflow-hidden">
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${accent}`} />
      <CardContent className="p-5">
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">{title}</h3>
        <div className="space-y-4">
          {metrics.map((metric) => {
            // Trying to parse out the primary value vs the small sentence if the mock format allows.
            // Assuming metric.value contains the value and metric.label contains the descriptive text, or vice versa.
            // The prompt says: "Each category should show: primary metric, status, one small sentence."
            // The API schema has {label: string, value: string}. Let's assume label is the category and value is the status/sentence.
            return (
              <div key={metric.label} className="flex justify-between items-start border-b border-border/40 last:border-0 pb-3 last:pb-0">
                <div>
                  <p className="text-sm font-bold text-foreground">{metric.label}</p>
                  <p className="text-xs text-muted-foreground font-medium mt-0.5">{metric.value}</p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}