import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useClienteUsage } from '@/hooks/useClienteUsage';
import { AlertTriangle, TrendingUp, Wrench, Calendar, Crown, Infinity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';

export const UsageLimitsCard = () => {
  const navigate = useNavigate();
  const { usageStats, isLoading, isNearLimit, isAtLimit, tier } = useClienteUsage();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  const matchingsNearLimit = usageStats.matchings.limit && 
    isNearLimit(usageStats.matchings.percentage);
  const matchingsAtLimit = isAtLimit(usageStats.matchings.used, usageStats.matchings.limit);
  
  const analisisNearLimit = usageStats.analisisReforma.limit && 
    isNearLimit(usageStats.analisisReforma.percentage);
  const analisisAtLimit = isAtLimit(usageStats.analisisReforma.used, usageStats.analisisReforma.limit);

  const showAlert = matchingsNearLimit || analisisNearLimit || matchingsAtLimit || analisisAtLimit;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Uso del Plan</CardTitle>
            <CardDescription>
              Controla tu consumo mensual y límites
            </CardDescription>
          </div>
          {tier !== 'free' && usageStats.proximoReset && (
            <Badge variant="outline" className="gap-1">
              <Calendar className="h-3 w-3" />
              Reset: {new Date(usageStats.proximoReset).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {showAlert && (
          <Alert variant={matchingsAtLimit || analisisAtLimit ? "destructive" : "default"}>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {matchingsAtLimit && "Has alcanzado el límite de matchings. "}
              {analisisAtLimit && "Has alcanzado el límite de análisis de reforma. "}
              {!matchingsAtLimit && !analisisAtLimit && "Te acercas al límite de tu plan. "}
              <Button 
                variant="link" 
                className="p-0 h-auto font-semibold"
                onClick={() => navigate('/cliente/dashboard')}
              >
                Actualizar plan
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Matchings */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="font-medium">Matchings</span>
            </div>
            <span className="text-sm text-muted-foreground">
              {usageStats.matchings.used}
              {usageStats.matchings.limit ? ` / ${usageStats.matchings.limit}` : ''}
              {!usageStats.matchings.limit && (
                <Infinity className="inline h-4 w-4 ml-1 text-primary" />
              )}
            </span>
          </div>
          
          {usageStats.matchings.limit ? (
            <>
              <div className="relative">
                <Progress 
                  value={Math.min(usageStats.matchings.percentage, 100)} 
                  className={`h-2 ${
                    matchingsAtLimit 
                      ? '[&>div]:bg-destructive' 
                      : usageStats.matchings.percentage >= 80 
                      ? '[&>div]:bg-warning' 
                      : '[&>div]:bg-primary'
                  }`}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {matchingsAtLimit 
                  ? "Límite alcanzado"
                  : `${Math.round(100 - usageStats.matchings.percentage)}% disponible`
                }
              </p>
            </>
          ) : (
            <div className="flex items-center gap-2 text-sm text-success">
              <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                Ilimitado
              </Badge>
              <span className="text-xs text-muted-foreground">
                Sin restricciones en tu plan
              </span>
            </div>
          )}
        </div>

        {/* Análisis de Reforma */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-primary" />
              <span className="font-medium">Análisis de Reforma</span>
            </div>
            <span className="text-sm text-muted-foreground">
              {usageStats.analisisReforma.used}
              {usageStats.analisisReforma.limit ? ` / ${usageStats.analisisReforma.limit}` : ''}
              {!usageStats.analisisReforma.limit && usageStats.analisisReforma.limit !== 0 && (
                <Infinity className="inline h-4 w-4 ml-1 text-primary" />
              )}
            </span>
          </div>
          
          {usageStats.analisisReforma.limit !== null && usageStats.analisisReforma.limit > 0 ? (
            <>
              <div className="relative">
                <Progress 
                  value={Math.min(usageStats.analisisReforma.percentage, 100)} 
                  className={`h-2 ${
                    analisisAtLimit 
                      ? '[&>div]:bg-destructive' 
                      : usageStats.analisisReforma.percentage >= 80 
                      ? '[&>div]:bg-warning' 
                      : '[&>div]:bg-primary'
                  }`}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {analisisAtLimit
                  ? "Límite alcanzado"
                  : `${Math.round(100 - usageStats.analisisReforma.percentage)}% disponible`
                }
              </p>
            </>
          ) : usageStats.analisisReforma.limit === null ? (
            <div className="flex items-center gap-2 text-sm text-success">
              <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                Ilimitado
              </Badge>
              <span className="text-xs text-muted-foreground">
                Sin restricciones en tu plan
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="secondary">
                No disponible
              </Badge>
              <span className="text-xs">
                Actualiza tu plan para acceder
              </span>
            </div>
          )}
        </div>

        {tier === 'free' && (
          <div className="pt-4 border-t">
            <Button 
              onClick={() => navigate('/cliente/dashboard')}
              className="w-full gap-2"
            >
              <Crown className="h-4 w-4" />
              Actualizar Plan para Más Límites
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
