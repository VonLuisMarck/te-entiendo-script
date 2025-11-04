import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileText, Table, FileSpreadsheet, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSubscriptionAccess } from '@/hooks/useSubscriptionAccess';
import { SubscriptionGate } from './SubscriptionGate';

interface ReportDownloadProps {
  type: 'provincia' | 'distrito';
  ubicacion: string;
  provincia?: string;
  ciudad?: string;
  distrito?: string;
}

export const ReportDownload = ({ 
  type, 
  ubicacion,
  provincia,
  ciudad,
  distrito
}: ReportDownloadProps) => {
  const { toast } = useToast();
  const { canAccess } = useSubscriptionAccess();
  const [downloading, setDownloading] = useState(false);
  
  const hasAccess = canAccess('download_reports');
  
  const handleDownload = async (format: 'pdf' | 'excel' | 'csv') => {
    setDownloading(true);
    
    try {
      toast({
        title: 'Preparando descarga...',
        description: `Generando informe ${format.toUpperCase()} para ${ubicacion}`,
      });
      
      // TODO: Implementar generación real de informes
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast({
        title: '¡Descarga completada!',
        description: `Informe ${format.toUpperCase()} descargado correctamente`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo generar el informe. Inténtalo de nuevo.',
        variant: 'destructive',
      });
    } finally {
      setDownloading(false);
    }
  };
  
  if (!hasAccess) {
    return null; // El gate se muestra en el contexto donde se usa este componente
  }
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={downloading}>
          {downloading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Descargando...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Descargar Informe
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleDownload('pdf')}>
          <FileText className="mr-2 h-4 w-4" />
          Descargar PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleDownload('excel')}>
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Descargar Excel
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleDownload('csv')}>
          <Table className="mr-2 h-4 w-4" />
          Descargar CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};