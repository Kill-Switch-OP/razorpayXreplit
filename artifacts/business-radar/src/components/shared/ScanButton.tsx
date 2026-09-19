import { useState } from 'react';
import { Button } from '@/components/ui';
import { useScanRadar, getGetRadarSummaryQueryKey, getListAnomaliesQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { ScanSearch, Loader2, CheckCircle2 } from 'lucide-react';

export function ScanButton() {
  const queryClient = useQueryClient();
  const scanMutation = useScanRadar();
  const [success, setSuccess] = useState(false);

  const handleScan = () => {
    scanMutation.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetRadarSummaryQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListAnomaliesQueryKey() });
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    });
  };

  if (success) {
    return (
      <Button variant="outline" className="border-green-500/50 bg-green-500/10 text-green-700 hover:bg-green-500/20 gap-2 cursor-default pointer-events-none">
        <CheckCircle2 className="h-4 w-4" />
        Scan Complete
      </Button>
    );
  }

  return (
    <Button 
      onClick={handleScan} 
      disabled={scanMutation.isPending}
      className="gap-2 font-medium"
    >
      {scanMutation.isPending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Scanning Systems...
        </>
      ) : (
        <>
          <ScanSearch className="h-4 w-4" />
          Run Cross-System Scan
        </>
      )}
    </Button>
  );
}
