import { Link } from 'wouter';
import { useGetRadarSummary, useListAnomalies, useScanRadar, getGetRadarSummaryQueryKey, getListAnomaliesQueryKey, type Anomaly } from '@workspace/api-client-react';
import { Card, CardContent, Skeleton, Button } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Activity, Users, Zap, RefreshCcw, Upload, ArrowRight, Banknote, Target } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

export default function Radar() {
  const queryClient = useQueryClient();
  const { data: summary, isLoading: loadingSummary } = useGetRadarSummary();
  const { data: anomalies, isLoading: loadingAnomalies } = useListAnomalies();
  const scanMutation = useScanRadar();
  const [isScanning, setIsScanning] = useState(false);
  const [filter, setFilter] = useState<string>('All');

  if (!loadingSummary && summary?.contextState === 'NO_CONTEXT') {
    return (
      <div className="space-y-8 animate-in fade-in duration-500 max-w-4xl mx-auto py-12">
        <h1 className="text-4xl font-bold tracking-tight">Radar</h1>
        <Card className="border-dashed border-2 shadow-none bg-card/50">
          <CardContent className="py-24 flex flex-col items-center text-center">
            <div className="h-16 w-16 bg-primary/5 rounded-full flex items-center justify-center mb-6">
              <Upload className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Upload your business data to scan for signals.</h2>
            <Link href="/data" className="mt-6 inline-flex items-center gap-2 rounded-sm bg-primary px-6 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-all shadow-sm">
              Upload Excel workbook <ArrowRight className="w-4 h-4" />
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleScan = () => {
    setIsScanning(true);
    scanMutation.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetRadarSummaryQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListAnomaliesQueryKey() });
      },
      onSettled: () => {
        setIsScanning(false);
      }
    });
  };

  const categories = ['All', 'Money', 'Inventory', 'Customers', 'Operations'];
  
  const filteredAnomalies = anomalies?.filter(a => {
    if (filter === 'All') return true;
    // Map systems to categories roughly, or rely on API tags if available.
    // We'll just do a basic string match for demo purposes based on 'systems'
    const sys = a.systems.join(' ').toLowerCase();
    if (filter === 'Money' && (sys.includes('razorpay') || sys.includes('settlement') || sys.includes('expense') || sys.includes('receivable'))) return true;
    if (filter === 'Inventory' && (sys.includes('inventory') || sys.includes('product') || sys.includes('supplier'))) return true;
    if (filter === 'Customers' && (sys.includes('customer') || sys.includes('support') || sys.includes('refund'))) return true;
    if (filter === 'Operations' && (sys.includes('order') || sys.includes('fulfillment'))) return true;
    return false;
  }) || [];

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b pb-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">Radar</h1>
          <p className="text-lg text-muted-foreground font-medium">What should you know about your business right now?</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-xs text-muted-foreground text-right hidden sm:block font-medium">
            Last scan:<br/>
            <span className="font-mono font-bold text-foreground">{summary ? formatDate(summary.lastScan) : '--'}</span>
          </div>
          <Button 
            onClick={handleScan} 
            disabled={isScanning || scanMutation.isPending}
            className="gap-2 font-bold rounded-sm shadow-sm"
          >
            <RefreshCcw className={`h-4 w-4 ${isScanning ? 'animate-spin' : ''}`} />
            {isScanning ? 'Scanning...' : 'Scan Data Hub'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard 
          title="Active Signals" 
          value={loadingSummary ? null : (summary?.businessSignals ?? null)} 
          icon={<Zap className="h-5 w-5 text-blue" />}
        />
        <KpiCard 
          title="High Risk Signals" 
          value={loadingSummary ? null : (summary?.highRisk ?? null)} 
          icon={<Target className="h-5 w-5 text-razorpay" />}
          alert={summary?.highRisk ? summary.highRisk > 0 : false}
        />
        <KpiCard 
          title="Quantified Exposure" 
          value={loadingSummary ? null : summary?.potentialExposure ? formatCurrency(summary.potentialExposure) : '₹0'} 
          icon={<Banknote className="h-5 w-5 text-replit" />}
          isCurrency
        />
        <KpiCard 
          title="Affected Customers" 
          value={loadingSummary ? null : (summary?.affectedCustomers ?? null)} 
          icon={<Users className="h-5 w-5 text-violet" />}
        />
      </div>

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            Discovered Signals <Badge count={anomalies?.length} />
          </h2>
          
          <div className="flex flex-wrap gap-2">
            {categories.map(c => (
              <button
                key={c}
                onClick={() => setFilter(c)}
                className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-sm transition-colors border shadow-sm ${
                  filter === c 
                    ? 'bg-primary text-primary-foreground border-primary' 
                    : 'bg-card text-muted-foreground hover:text-foreground border-border/50'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        
        {loadingAnomalies ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="h-48 shadow-sm"><CardContent className="p-6"><Skeleton className="h-full w-full" /></CardContent></Card>
            ))}
          </div>
        ) : filteredAnomalies.length === 0 ? (
          <div className="py-24 text-center text-muted-foreground border rounded-sm bg-card/50 font-medium">
            No active signals were found for this category.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAnomalies.map((anomaly) => (
              <SignalCard key={anomaly.id} anomaly={anomaly} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SignalCard({ anomaly }: { anomaly: Anomaly }) {
  const getSeverityColors = (sev: string) => {
    switch (sev) {
      case 'HIGH': return { bg: 'bg-razorpay', text: 'text-razorpay', border: 'border-razorpay/20', fill: 'bg-razorpay/5' };
      case 'MEDIUM': return { bg: 'bg-replit', text: 'text-replit', border: 'border-replit/20', fill: 'bg-replit/5' };
      default: return { bg: 'bg-violet', text: 'text-violet', border: 'border-violet/20', fill: 'bg-violet/5' };
    }
  };
  const colors = getSeverityColors(anomaly.severity);
  const displayTitle = anomaly.id === 'orphan-settlements'
    ? `${formatCurrency(anomaly.impactAmount)} in settlements cannot be matched`
    : anomaly.title;

  return (
    <Link href={`/investigations/${anomaly.id}`}>
      <Card className={`border shadow-sm flex flex-col h-full bg-card hover:shadow-md transition-all cursor-pointer group ${colors.border}`}>
        <div className={`h-1 w-full ${colors.bg}`} />
        <CardContent className="p-5 flex flex-col flex-1">
          <div className="flex justify-between items-start mb-3">
            <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-sm ${colors.fill} ${colors.text}`}>
              {anomaly.severity} PRIORITY
            </span>
            <span className="text-xs font-mono font-bold text-muted-foreground">
              {anomaly.affectedRecords} records
            </span>
          </div>
          
          <h3 className="font-bold text-base leading-snug mb-2 group-hover:underline">
            {displayTitle}
          </h3>
          <p className="text-sm text-muted-foreground font-medium line-clamp-2 mb-6">
            {anomaly.summary}
          </p>
          
          <div className="mt-auto pt-4 border-t border-border/40 flex items-center justify-between">
            <div className="flex flex-wrap gap-1.5">
              {anomaly.systems.slice(0,2).map(sys => (
                <span key={sys} className="text-[9px] uppercase font-bold tracking-widest bg-muted px-1.5 py-0.5 rounded-sm text-muted-foreground">
                  {sys}
                </span>
              ))}
              {anomaly.systems.length > 2 && <span className="text-[9px] font-bold text-muted-foreground">+{anomaly.systems.length - 2}</span>}
            </div>
            
            {anomaly.impactAmount > 0 && (
              <span className="font-mono font-bold text-sm">
                {formatCurrency(anomaly.impactAmount)}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}


function KpiCard({ title, value, icon, alert = false, isCurrency = false }: { title: string, value: string | number | null, icon: React.ReactNode, alert?: boolean, isCurrency?: boolean }) {
  return (
    <Card className={`border shadow-sm bg-card ${alert ? 'border-razorpay/30' : ''}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</p>
            {value === null ? (
              <Skeleton className="h-8 w-24 mt-2" />
            ) : (
              <p className={`text-3xl font-bold mt-2 tracking-tight ${isCurrency ? 'font-mono' : ''} ${alert ? 'text-razorpay' : 'text-foreground'}`}>
                {value}
              </p>
            )}
          </div>
          <div className={`p-2 rounded-sm shadow-sm ${alert ? 'bg-razorpay/10' : 'bg-muted'}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Badge({ count }: { count?: number }) {
  if (count === undefined) return null;
  return (
    <span className="inline-flex items-center justify-center bg-primary text-primary-foreground text-[10px] font-mono font-bold px-2 py-0.5 rounded-full shadow-sm">
      {count}
    </span>
  );
}