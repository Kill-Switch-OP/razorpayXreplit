import { useState, useRef } from 'react';
import { useClearBusinessWorkbook, useGetDataHub, useImportBusinessWorkbook, getGetDataHubQueryKey, getGetBusinessOverviewQueryKey, getGetRadarSummaryQueryKey, getListAnomaliesQueryKey } from '@workspace/api-client-react';
import { Card, CardContent, Button, Skeleton } from '@/components/ui';
import { Database, FileSpreadsheet, Upload, CheckCircle2, AlertCircle, RefreshCw, X, ArrowRight } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';

export default function Data() {
  const queryClient = useQueryClient();
  const { data: dataHub, isLoading } = useGetDataHub();
  const importMutation = useImportBusinessWorkbook();
  const clearMutation = useClearBusinessWorkbook();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [dragActive, setDragActive] = useState(false);

  const refreshBusinessContext = () => {
    queryClient.invalidateQueries({ queryKey: getGetDataHubQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetBusinessOverviewQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetRadarSummaryQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListAnomaliesQueryKey() });
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = (file: File) => {
    if (!file.name.endsWith('.xlsx')) {
      toast.error('Only .xlsx files are supported');
      return;
    }

    importMutation.mutate({ data: { file } }, {
      onSuccess: () => {
        toast.success('Workbook imported successfully');
        refreshBusinessContext();
      },
      onError: () => {
        toast.error('Failed to import workbook');
      }
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const triggerSelect = () => {
    fileInputRef.current?.click();
  };

  const clearWorkbook = () => {
    if (!window.confirm('Remove this workbook and clear all imported metrics, signals, and Copilot context?')) return;
    clearMutation.mutate(undefined, {
      onSuccess: () => {
        refreshBusinessContext();
        toast.success('Workbook removed');
      },
      onError: () => {
        toast.error('Failed to remove workbook');
      },
    });
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-500 pt-4">
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-6 border-b pb-6">
        <div className="space-y-2">
          <div className="inline-flex px-2 py-1 bg-primary text-primary-foreground text-[10px] font-bold tracking-widest rounded-sm uppercase">
            Data Hub
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground">Your business context</h1>
          <p className="text-lg text-muted-foreground font-medium max-w-2xl">Connect Razorpay payment movement with your operational reality.</p>
        </div>
        
        {!isLoading && dataHub && dataHub.contextState !== 'NO_CONTEXT' && (
          <div className="bg-card border shadow-sm px-6 py-4 rounded-sm flex items-center gap-8">
             <div>
               <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Datasets Recognized</p>
               <p className="text-2xl font-bold font-mono">{dataHub.recognizedDatasets}</p>
             </div>
             <div className="w-px h-10 bg-border" />
             <div>
               <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Records Indexed</p>
               <p className="text-2xl font-bold font-mono">{dataHub.totalRecords.toLocaleString()}</p>
             </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 relative">
        
        {/* Visual Connector for large screens */}
        <div className="hidden lg:flex absolute left-1/2 top-12 bottom-12 w-px bg-border -translate-x-1/2 flex-col items-center justify-center pointer-events-none">
           <div className="bg-card border shadow-sm p-2 rounded-full absolute">
             <ArrowRight className="w-4 h-4 text-muted-foreground" />
           </div>
        </div>

        {/* Left Column: Connections */}
        <div className="space-y-8 pr-0 lg:pr-8">
          
          <div className="space-y-4">
            <div className="flex items-center gap-3 border-b pb-2">
              <div className="w-3 h-3 rounded-full bg-razorpay" />
              <h2 className="text-xl font-bold uppercase tracking-widest text-foreground">
                Razorpay Layer
              </h2>
              <span className="text-xs text-muted-foreground font-medium italic ml-2">"Where money moves"</span>
            </div>
            
            <div className="grid gap-3">
              {isLoading ? (
                Array.from({ length: 2 }).map((_, i) => (
                  <Card key={i} className="border shadow-sm bg-card"><CardContent className="p-5"><Skeleton className="h-12 w-full" /></CardContent></Card>
                ))
              ) : dataHub?.razorpay.map(source => (
                <div key={source.id} className="border bg-card rounded-sm p-4 shadow-sm flex items-center justify-between group hover:border-razorpay/30 transition-colors">
                  <div className="flex items-center gap-4">
                     <div className="font-bold text-foreground text-sm uppercase tracking-wider">{source.name}</div>
                     <span className={`text-[10px] px-2 py-0.5 rounded-sm border font-bold uppercase tracking-wider ${source.active ? 'text-green-600 border-green-600/20 bg-green-50' : 'text-muted-foreground border-border'}`}>
                       {source.active ? 'Active' : 'Unavailable'}
                     </span>
                  </div>
                  <span className="text-xs font-mono font-bold text-muted-foreground bg-muted px-2 py-1 rounded-sm border">
                    {source.recordCount.toLocaleString()} records
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4 pt-4">
            <div className="flex items-center gap-3 border-b pb-2">
              <div className="w-3 h-3 rounded-full bg-violet" />
              <h2 className="text-xl font-bold uppercase tracking-widest text-foreground">
                Business Radar
              </h2>
              <span className="text-xs text-muted-foreground font-medium italic ml-2">"Where business context lives"</span>
            </div>

            <div className="grid gap-3">
              {isLoading ? null : dataHub?.business.map(source => (
                <div key={source.id} className="border bg-card rounded-sm p-4 shadow-sm flex items-center justify-between group hover:border-violet/30 transition-colors">
                  <div className="flex items-center gap-4">
                     <div className="font-bold text-foreground text-sm uppercase tracking-wider">{source.name}</div>
                     <span className={`text-[10px] px-2 py-0.5 rounded-sm border font-bold uppercase tracking-wider ${source.active ? 'text-green-600 border-green-600/20 bg-green-50' : 'text-muted-foreground border-border'}`}>
                       {source.active ? 'Recognized' : 'Missing'}
                     </span>
                  </div>
                  <span className="text-xs font-mono font-bold text-muted-foreground bg-muted px-2 py-1 rounded-sm border">
                    {source.recordCount.toLocaleString()} records
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Workbook Import */}
        <div className="space-y-8 pl-0 lg:pl-8">
          
          <div className="space-y-4">
             <div className="flex items-center gap-3 border-b pb-2">
              <FileSpreadsheet className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-bold uppercase tracking-widest text-foreground">
                Operational Data
              </h2>
            </div>
          
            <Card 
              className={`border-2 border-dashed shadow-sm transition-all rounded-sm ${dragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 bg-card/50'}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <CardContent className="p-12 flex flex-col items-center justify-center text-center">
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleChange}
                  accept=".xlsx"
                  className="hidden" 
                />
                
                <div className={`p-4 rounded-full mb-5 ${importMutation.isPending ? 'bg-primary/10 text-primary animate-pulse' : 'bg-muted text-muted-foreground shadow-sm'}`}>
                  {importMutation.isPending ? <RefreshCw className="h-8 w-8 animate-spin" /> : <Upload className="h-8 w-8" />}
                </div>
                
                <h3 className="text-xl font-bold mb-3">
                  {importMutation.isPending ? 'Uploading workbook...' : 'Upload Business Workbook'}
                </h3>
                <p className="text-sm text-muted-foreground font-medium max-w-sm mb-8 leading-relaxed">
                  Drag and drop your Excel (.xlsx) file here, or click to browse. We support standard operational sheets.
                </p>
                
                <Button onClick={triggerSelect} disabled={importMutation.isPending} variant={dragActive ? "default" : "outline"} className="font-bold shadow-sm px-8 py-6 text-base rounded-sm">
                  Select .xlsx File
                </Button>

                {!isLoading && dataHub?.supportedSheets && (
                  <div className="mt-10 pt-6 border-t w-full text-left">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Supported Sheets</p>
                    <div className="flex flex-wrap gap-2">
                      {dataHub.supportedSheets.map(sheet => (
                        <span key={sheet} className="text-[10px] font-bold bg-card text-foreground px-2 py-1 rounded-sm uppercase tracking-wider border shadow-sm">
                          {sheet}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {!isLoading && dataHub?.businessData && (
              <Card className="border shadow-sm overflow-hidden bg-card rounded-sm">
                <div className="bg-primary/5 px-6 py-4 border-b flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <h3 className="font-bold text-sm uppercase tracking-widest">Active Workbook</h3>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground font-mono font-bold bg-card border px-2 py-0.5 rounded-sm">
                      {formatDate(dataHub.businessData.importedAt)}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 text-destructive border-destructive/20 hover:bg-destructive/10 rounded-sm"
                      onClick={clearWorkbook}
                      disabled={clearMutation.isPending}
                      aria-label="Remove imported workbook"
                    >
                      {clearMutation.isPending ? <RefreshCw className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>
                <CardContent className="p-0">
                  <div className="p-6 border-b">
                    <p className="font-bold text-lg text-foreground">{dataHub.businessData.fileName}</p>
                    {dataHub.dataHealth && (
                      <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-y-3 gap-x-6 text-xs font-medium">
                        <div className="flex justify-between border-b pb-1">
                           <span className="text-muted-foreground">Relationships</span>
                           <span className="font-bold font-mono">{dataHub.dataHealth.relationshipsResolved}</span>
                        </div>
                        <div className="flex justify-between border-b pb-1">
                           <span className="text-muted-foreground">Missing IDs</span>
                           <span className="font-bold font-mono">{dataHub.dataHealth.missingRequiredIds}</span>
                        </div>
                        <div className="flex justify-between border-b pb-1">
                           <span className="text-muted-foreground">Warnings</span>
                           <span className="font-bold font-mono">{dataHub.dataHealth.warnings.length}</span>
                        </div>
                        <div className="flex justify-between border-b pb-1">
                           <span className="text-muted-foreground">Duplicate IDs</span>
                           <span className="font-bold font-mono">{dataHub.dataHealth.duplicateIds}</span>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="divide-y max-h-[300px] overflow-auto bg-muted/10">
                    {dataHub.businessData.sheets.map((sheet, idx) => (
                      <div key={idx} className={`p-4 ${sheet.supported ? '' : 'opacity-50 grayscale'}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-sm uppercase tracking-wider">{sheet.name}</span>
                            {!sheet.supported && (
                              <span className="text-[9px] font-bold bg-muted text-muted-foreground px-1.5 py-0.5 rounded-sm uppercase tracking-widest border">
                                Unsupported
                              </span>
                            )}
                          </div>
                          <span className="text-xs font-mono font-bold bg-card border px-2 py-0.5 rounded-sm text-muted-foreground shadow-sm">
                            {sheet.rowCount} rows
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}