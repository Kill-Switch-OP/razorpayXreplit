import { useState, useRef, useEffect } from 'react';
import { Link } from 'wouter';
import { useAskBusinessCopilot, useGetDataHub, type BusinessCopilotAnswer } from '@workspace/api-client-react';
import { Card, CardContent, Button, Input } from '@/components/ui';
import { Sparkles, Send, Upload, Calculator, Lightbulb, Target } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  answer?: BusinessCopilotAnswer;
}

export default function Copilot() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const askMutation = useAskBusinessCopilot();
  const { data: dataHub, isLoading: loadingHub } = useGetDataHub();
  const bottomRef = useRef<HTMLDivElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || askMutation.isPending) return;

    const userMessage = input.trim();
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setInput('');

    askMutation.mutate(
      { data: { question: userMessage } },
      {
        onSuccess: (res) => {
           setMessages(prev => [...prev, {
            role: 'assistant',
             content: res.verdict,
             answer: res,
          }]);
        }
      }
    );
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, askMutation.isPending]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-5xl mx-auto h-[calc(100vh-140px)] flex flex-col pt-4">
      <div className="flex flex-col gap-2">
        <div className="inline-flex px-2 py-1 bg-primary text-primary-foreground text-[10px] font-bold tracking-widest rounded-sm uppercase w-max">
          Decision Support
        </div>
        <h1 className="text-4xl font-bold tracking-tight">
          Business Copilot
        </h1>
        <p className="text-lg font-medium text-muted-foreground">Evidence-grounded answers based on your cross-system data.</p>
      </div>

      <Card className="border shadow-sm flex flex-col flex-1 overflow-hidden relative bg-card">
        <div className="absolute top-0 left-0 right-0 h-1 bg-primary z-20" />
        <CardContent className="p-0 flex-1 flex flex-col overflow-hidden relative z-10">
          <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8">
             {!loadingHub && dataHub?.contextState === 'NO_CONTEXT' ? (
               <div className="h-full flex flex-col items-center justify-center text-center">
                 <div className="h-20 w-20 bg-primary/5 rounded-full flex items-center justify-center mb-6">
                   <Upload className="h-10 w-10 text-primary" />
                 </div>
                 <h3 className="text-2xl font-bold text-foreground mb-3">Upload data to ask business questions.</h3>
                 <p className="text-muted-foreground font-medium mb-8">Copilot requires your operational context to give accurate answers.</p>
                 <Link href="/data" className="rounded-sm bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-sm">Upload Excel workbook</Link>
               </div>
             ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center max-w-2xl mx-auto">
                <Sparkles className="h-16 w-16 text-primary mb-6" />
                <h3 className="text-2xl font-bold text-foreground mb-4">How can I help you analyze your business?</h3>
                <p className="text-base text-muted-foreground font-medium mb-10">
                  Ask specific operational questions. Copilot will cross-reference Razorpay payments with inventory, customers, and orders to give a deterministic answer.
                </p>
                <div className="w-full text-left">
                   <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 pl-1">Contextual Questions</p>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     {(dataHub?.suggestedPrompts ?? [
                       "Can I afford ₹3L of inventory?",
                       "What's putting cash under pressure?",
                       "Which products could run out?",
                       "What needs my attention today?"
                     ]).map(q => (
                       <button 
                         key={q} 
                         onClick={() => setInput(q)}
                         className="text-sm font-bold bg-muted hover:bg-muted/80 text-foreground p-4 rounded-sm transition-colors border shadow-sm flex items-start gap-3 text-left"
                       >
                         <Target className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                         <span className="leading-snug">{q}</span>
                       </button>
                     ))}
                   </div>
                </div>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'user' ? (
                    <div className="max-w-[70%] rounded-sm p-4 text-sm font-bold bg-primary text-primary-foreground shadow-sm">
                      <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  ) : (
                    <div className="w-full max-w-4xl">
                      {msg.answer && <StructuredAnswer answer={msg.answer} />}
                    </div>
                  )}
                </div>
              ))
            )}
            
            {askMutation.isPending && (
              <div className="flex justify-start w-full">
                <div className="rounded-sm p-5 text-sm bg-muted border shadow-sm font-bold">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Sparkles className="h-5 w-5 animate-pulse text-primary" />
                    <span>Crunching business and payment records...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          
          <form onSubmit={handleSubmit} className="p-5 bg-card border-t shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
            <div className="relative flex items-center bg-muted/50 rounded-sm border focus-within:ring-2 focus-within:ring-primary/20 transition-all p-1.5 shadow-sm max-w-4xl mx-auto">
              <Input 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about revenue, missing settlements, inventory..."
                className="border-0 bg-transparent shadow-none focus-visible:ring-0 pr-12 text-sm font-bold h-12"
                 disabled={askMutation.isPending || dataHub?.contextState === 'NO_CONTEXT'}
              />
              <Button 
                type="submit" 
                size="icon" 
                className="absolute right-2 h-10 w-10 rounded-sm shrink-0 font-bold"
                 disabled={!input.trim() || askMutation.isPending || dataHub?.contextState === 'NO_CONTEXT'}
              >
                <Send className="h-5 w-5" />
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function StructuredAnswer({ answer }: { answer: BusinessCopilotAnswer }) {
  if (!answer) return null;
  return (
    <div className="bg-card border rounded-sm shadow-sm overflow-hidden flex flex-col">
      <div className="bg-primary/5 px-6 py-4 border-b flex justify-between items-center">
        <h3 className="font-bold text-lg flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          Business Decision Memo
        </h3>
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted px-2 py-1 rounded-sm">
          {answer.usedAi ? 'AI Analysis' : 'Deterministic Calculation'}
        </span>
      </div>
      
      <div className="p-6 md:p-8 space-y-8">
        
        {/* Verdict & Summary */}
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">Verdict</p>
          <p className="text-2xl font-bold text-foreground">{answer.verdict}</p>
          <p className="text-base font-medium text-muted-foreground mt-3 leading-relaxed max-w-3xl">{answer.summary}</p>
        </div>
        
        {/* Grid for Calculation & Evidence */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {answer.calculation && answer.calculation.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold flex items-center gap-2 mb-4">
                <Calculator className="h-3.5 w-3.5" /> Calculation
              </p>
              <div className="space-y-2">
                {answer.calculation.map((item, idx) => {
                  const isTotal = idx === answer.calculation.length - 1;
                  return (
                    <div key={item.label} className={`flex justify-between items-center px-3 py-2 text-sm font-mono ${isTotal ? 'bg-primary/5 font-bold border-t-2 border-primary/20 mt-4 pt-3' : 'bg-muted/30 border-b border-border/40'}`}>
                      <span className={isTotal ? 'text-foreground' : 'text-muted-foreground'}>{item.label}</span>
                      <span className="text-foreground">{item.value}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {answer.evidence && answer.evidence.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-4">
                Evidence Sources
              </p>
              <div className="space-y-3">
                {answer.evidence.map(item => (
                  <div key={`${item.source}-${item.dataset}`} className="text-sm bg-muted rounded-sm p-3 border shadow-sm">
                    <div className="flex justify-between items-start mb-1">
                      <div className="font-bold text-foreground">
                        {item.source} <span className="text-muted-foreground font-medium mx-1">·</span> {item.dataset}
                      </div>
                      <span className="text-[10px] font-mono font-bold text-muted-foreground bg-card px-2 py-0.5 rounded-sm border">
                        {item.records} records
                      </span>
                    </div>
                    {item.recordIds.length > 0 && (
                      <div className="text-xs text-muted-foreground font-mono mt-2 truncate">
                        IDs: {item.recordIds.join(', ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          
        </div>

        {/* Action & Confidence */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold flex items-center gap-2 mb-3">
              <Lightbulb className="h-3.5 w-3.5" /> Recommended Action
            </p>
            <p className="text-base font-bold text-foreground">{answer.action}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-3">
              Confidence Level
            </p>
            <div className="inline-flex px-3 py-1.5 bg-muted border font-bold text-sm rounded-sm uppercase tracking-wider">
              {answer.confidence}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}