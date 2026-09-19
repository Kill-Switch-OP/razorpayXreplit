import { useState, useRef, useEffect } from 'react';
import { useRoute, Link } from 'wouter';
import { getGetAnomalyQueryKey, useGetAnomaly, useAskCopilot } from '@workspace/api-client-react';
import { Card, CardContent, Button, Input, Skeleton } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/utils';
import { ArrowLeft, Sparkles, Send, FileText, Target, ShieldQuestion, Database, CheckCircle2, AlertCircle } from 'lucide-react';

export default function Investigation() {
  const [, params] = useRoute('/investigations/:id');
  const id = params?.id;
  
  const { data: investigation, isLoading, isError, refetch } = useGetAnomaly(id || '', {
    query: { enabled: !!id, queryKey: getGetAnomalyQueryKey(id || '') }
  });

  if (!id) return <div>Invalid ID</div>;

  if (isLoading) {
    return (
      <div className="space-y-6 animate-in fade-in py-8">
        <div className="flex items-center gap-4 border-b pb-6">
          <Skeleton className="h-10 w-10 rounded-sm" />
          <div className="space-y-2">
            <Skeleton className="h-10 w-96" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
          <Skeleton className="h-[600px] w-full" />
        </div>
      </div>
    );
  }

  if (isError || !investigation) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <ShieldQuestion className="h-16 w-16 text-muted-foreground mb-6" />
        <h2 className="text-2xl font-bold tracking-tight mb-2">Investigation Not Found</h2>
        <p className="text-muted-foreground mb-8 font-medium">The requested business signal could not be located.</p>
        <Link href="/" className="inline-flex items-center justify-center rounded-sm bg-primary px-6 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 shadow-sm">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Radar
        </Link>
      </div>
    );
  }

  const { anomaly } = investigation;

  const getSeverityColors = (sev: string) => {
    switch (sev) {
      case 'HIGH': return { bg: 'bg-razorpay', text: 'text-razorpay', fill: 'bg-razorpay/10' };
      case 'MEDIUM': return { bg: 'bg-replit', text: 'text-replit', fill: 'bg-replit/10' };
      default: return { bg: 'bg-violet', text: 'text-violet', fill: 'bg-violet/10' };
    }
  };
  const colors = getSeverityColors(anomaly.severity);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 pt-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 border-b pb-6">
        <div className="flex items-start gap-4">
          <Link href="/radar" className="mt-1 p-2 border bg-card rounded-sm hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shadow-sm shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-sm ${colors.fill} ${colors.text}`}>
                {anomaly.severity} PRIORITY
              </span>
              <span className="text-xs text-muted-foreground font-mono font-bold">ID: {anomaly.id}</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground leading-tight">
              {anomaly.title}
            </h1>
            <p className="text-muted-foreground font-medium mt-2 max-w-2xl text-lg">
              {anomaly.summary}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Button className="font-bold rounded-sm shadow-sm gap-2">
            <CheckCircle2 className="w-4 h-4" /> Resolve Issue
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Analysis & Copilot */}
        <div className="lg:col-span-2 space-y-8">
          
          <div className="space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              What We Found
            </h2>
            <Card className="border shadow-sm bg-card text-foreground">
              <CardContent className="p-6 md:p-8">
                <p className="text-lg leading-relaxed font-medium">
                  {investigation.executiveExplanation}
                </p>
                
                <div className="mt-8 p-5 bg-primary/5 border border-primary/10 rounded-sm">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2 mb-3">
                    <Target className="h-4 w-4" /> What to do next
                  </h4>
                  <p className="text-base font-bold text-foreground">
                    {anomaly.recommendedAction}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                Known Facts
              </h2>
              <Card className="border shadow-sm h-full bg-card">
                <CardContent className="p-6">
                  <ul className="space-y-4">
                    {investigation.knownFacts.map((fact, i) => (
                      <li key={i} className="text-sm font-medium text-foreground flex items-start gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-foreground mt-1.5 shrink-0" />
                        <span className="leading-snug">{fact}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>

             <div className="space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                Uncertainties
              </h2>
              <Card className="border shadow-sm h-full bg-card">
                <CardContent className="p-6">
                  <ul className="space-y-4">
                    {investigation.uncertainties.map((gap, i) => (
                      <li key={i} className="text-sm font-medium text-foreground flex items-start gap-3">
                        <AlertCircle className="w-4 h-4 text-replit mt-0.5 shrink-0" />
                        <span className="leading-snug">{gap}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* AI Copilot */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
               Investigation Copilot
            </h2>
            <CopilotChat investigationId={anomaly.id} />
          </div>
        </div>

        {/* Right Column: Evidence Chain */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center justify-between">
            <span>Evidence Timeline</span>
            <span className="text-xs bg-muted px-2 py-0.5 rounded-sm">{anomaly.evidenceCount} records</span>
          </h2>
          
          <Card className="border shadow-sm h-[calc(100vh-16rem)] flex flex-col bg-card overflow-hidden">
            <CardContent className="p-0 flex-1 overflow-auto">
              <div className="relative p-6">
                {/* Vertical connecting line */}
                <div className="absolute left-[39px] top-10 bottom-10 w-[2px] bg-border" />
                
                <div className="space-y-10">
                  {investigation.evidence.map((record, index) => {
                    const isMissing = record.status.toLowerCase().includes('fail') || record.status.toLowerCase().includes('missing');
                    return (
                    <div key={record.id} className="relative flex gap-5 group">
                      {/* Timeline node */}
                      <div className="relative z-10 shrink-0 mt-1">
                        <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center bg-card transition-colors
                          ${isMissing ? 'border-razorpay text-razorpay' : 'border-primary text-primary'}`}>
                          <Database className="h-3.5 w-3.5" />
                        </div>
                      </div>
                      
                      {/* Evidence Card */}
                      <div className={`flex-1 border rounded-sm p-4 shadow-sm transition-colors
                        ${isMissing ? 'bg-razorpay/5 border-razorpay/30' : 'bg-card border-border/60 hover:border-primary/30'}`}>
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] uppercase font-bold tracking-widest text-muted-foreground bg-muted px-1.5 py-0.5 rounded-sm">
                              {record.system}
                            </span>
                          </div>
                          <span className="text-[10px] text-muted-foreground font-mono font-bold">
                            {formatDate(record.timestamp)}
                          </span>
                        </div>
                        
                        <h4 className="text-sm font-bold mb-1 leading-snug">{record.label}</h4>
                        <p className="text-xs text-muted-foreground font-medium mb-4">{record.detail}</p>
                        
                        <div className="flex flex-wrap items-center gap-2 mt-auto">
                          <div className="text-[10px] font-mono font-bold bg-muted px-2 py-1 rounded-sm text-foreground">
                            ID: {record.recordId}
                          </div>
                          <div className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-sm ${
                            isMissing
                              ? 'text-razorpay bg-razorpay/10'
                              : 'text-primary bg-primary/10'
                          }`}>
                            {record.status}
                          </div>
                          {record.amount !== undefined && record.amount !== null && (
                            <div className="text-[11px] font-mono font-bold ml-auto bg-card border px-2 py-1 rounded-sm shadow-sm">
                              {formatCurrency(record.amount)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )})}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function CopilotChat({ investigationId }: { investigationId: string }) {
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant', content: string, basis?: string[] }>>([]);
  const [input, setInput] = useState('');
  const askMutation = useAskCopilot();
  const bottomRef = useRef<HTMLDivElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || askMutation.isPending) return;

    const userMessage = input.trim();
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setInput('');

    askMutation.mutate(
      { id: investigationId, data: { question: userMessage } },
      {
        onSuccess: (res) => {
          setMessages(prev => [...prev, { role: 'assistant', content: res.answer, basis: res.basis }]);
        }
      }
    );
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, askMutation.isPending]);

  return (
    <Card className="border shadow-sm flex flex-col h-[500px] bg-card overflow-hidden relative">
      <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
        <Sparkles className="w-32 h-32 text-primary" />
      </div>
      <CardContent className="p-0 flex-1 flex flex-col z-10 relative h-full">
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground p-6">
              <Sparkles className="h-10 w-10 text-primary mb-4" />
              <p className="text-sm font-medium max-w-sm mb-6">Ask direct questions about this specific anomaly. Copilot will cross-reference all linked records.</p>
              <div className="flex flex-col w-full max-w-xs gap-2">
                {['What is the root cause?', 'Which users are impacted?', 'Is this a known systemic issue?'].map(q => (
                  <button 
                    key={q} 
                    onClick={() => setInput(q)}
                    className="text-xs font-bold bg-muted hover:bg-muted/80 text-foreground px-4 py-2.5 rounded-sm transition-colors border shadow-sm text-left flex items-center gap-2"
                  >
                    <Target className="w-3 h-3 text-primary" /> {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-sm p-4 text-sm font-medium shadow-sm ${
                  msg.role === 'user' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted border text-foreground'
                }`}>
                  {msg.role === 'assistant' && (
                    <div className="flex items-center gap-2 mb-2 text-primary">
                      <Sparkles className="h-4 w-4" />
                      <span className="font-bold text-[10px] uppercase tracking-widest">Business Copilot</span>
                    </div>
                  )}
                  <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  
                  {msg.basis && msg.basis.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-border/50">
                      <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-2 font-bold">Evidence Based On</p>
                      <ul className="space-y-1.5">
                        {msg.basis.map((b, idx) => (
                          <li key={idx} className="text-xs text-muted-foreground flex items-start gap-2">
                            <FileText className="h-3.5 w-3.5 mt-0.5 shrink-0 opacity-70" />
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          
          {askMutation.isPending && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-sm p-4 text-sm bg-muted border shadow-sm">
                <div className="flex items-center gap-3 text-muted-foreground font-bold">
                  <Sparkles className="h-4 w-4 animate-pulse text-primary" />
                  <span>Connecting operational context...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 bg-card border-t">
          <div className="relative flex items-center bg-muted/50 rounded-sm border focus-within:ring-2 focus-within:ring-primary/20 transition-all p-1.5 shadow-sm">
            <Input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about this investigation..."
              className="border-0 bg-transparent shadow-none focus-visible:ring-0 pr-12 text-sm font-medium"
              disabled={askMutation.isPending}
            />
            <Button 
              type="submit" 
              size="icon"
              className="absolute right-2 h-8 w-8 rounded-sm shrink-0 font-bold"
              disabled={!input.trim() || askMutation.isPending}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}