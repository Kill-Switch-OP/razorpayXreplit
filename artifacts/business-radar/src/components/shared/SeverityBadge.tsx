import { Badge } from '@/components/ui';
import { Severity } from '@workspace/api-client-react';
import { AlertCircle, AlertTriangle, Info } from 'lucide-react';

export function SeverityBadge({ severity }: { severity: string }) {
  switch (severity) {
    case Severity.HIGH:
    case 'HIGH':
      return (
        <Badge variant="destructive" className="gap-1 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider">
          <AlertCircle className="h-3 w-3" />
          High Risk
        </Badge>
      );
    case Severity.MEDIUM:
    case 'MEDIUM':
      return (
        <Badge variant="warning" className="gap-1 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider">
          <AlertTriangle className="h-3 w-3" />
          Medium Risk
        </Badge>
      );
    case Severity.LOW:
    case 'LOW':
    default:
      return (
        <Badge variant="secondary" className="gap-1 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground border border-border">
          <Info className="h-3 w-3" />
          Low Risk
        </Badge>
      );
  }
}
