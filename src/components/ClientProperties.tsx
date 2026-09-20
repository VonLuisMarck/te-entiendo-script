import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ensureClientProfile } from '@/lib/client-profile';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Heart, ExternalLink, RefreshCw, Home } from 'lucide-react';
import { toast } from 'sonner';

interface Recommendation {
  id: string; favorito: boolean; score: number; criterios_cumplidos: Record<string, unknown>;
  propiedad: { id: string; titulo: string; precio: number; ubicacion: string; metros: number | null;
    dormitorios: number | null; banos: number | null; url: string; imagenes: string[] | null;
    last_seen: string | null; portal_origen: string; activo: boolean };
}
const PAGE_SIZE = 12;
const labels: Record<string, string> = { presupuesto: 'Presupuesto', ubicacion: 'Zona', tipoPropiedad: 'Tipo',
  superficie: 'Superficie', dormitorios: 'Dormitorios', banos: 'Baños', ascensor: 'Ascensor', parking: 'Parking', condicion: 'Estado' };
const safeUrl = (value: string) => { try { const u = new URL(value); return u.protocol === 'https:' ? u.href : undefined; } catch { return undefined; } };

export function ClientProperties() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Recommendation[]>([]);
  const [page, setPage] = useState(0);
  const [more, setMore] = useState(false);
  const [favorites, setFavorites] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [saving, setSaving] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setError(false);
      try {
        const clientId = await ensureClientProfile();
        let query = supabase.from('matchings')
          .select('id,favorito,score,criterios_cumplidos,propiedad:propiedades!inner(id,titulo,precio,ubicacion,metros,dormitorios,banos,url,imagenes,last_seen,portal_origen,activo)')
          .eq('cliente_id', clientId).gte('score', 60).eq('propiedad.activo', true)
          .gte('propiedad.last_seen', new Date(Date.now() - 7 * 86400000).toISOString())
          .order('score', { ascending: false }).order('id').range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
        if (favorites) query = query.eq('favorito', true);
        const { data, error: queryError } = await query;
        if (queryError) throw queryError;
        if (!cancelled) { setMore(data.length > PAGE_SIZE); setItems(data.slice(0, PAGE_SIZE) as unknown as Recommendation[]); }
      } catch { if (!cancelled) { setError(true); setItems([]); } }
      finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, [page, favorites, refresh]);

  async function toggleFavorite(item: Recommendation) {
    setSaving(item.id);
    const { error, data } = await supabase.from('matchings').update({ favorito: !item.favorito }).eq('id', item.id).select('id');
    if (error || !data?.length) toast.error('No se pudo guardar el favorito');
    else setRefresh(n => n + 1);
    setSaving(null);
  }
  return <section className="mb-10" aria-labelledby="recommendations-title">
    <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
      <div><h2 id="recommendations-title" className="text-2xl font-bold">Tus inmuebles</h2>
        <p className="text-muted-foreground text-sm">Anuncios observados en los últimos 7 días. Confirma su disponibilidad con el anunciante.</p></div>
      <div className="flex gap-2 flex-wrap">
        <Button variant="outline" onClick={() => { setFavorites(v => !v); setPage(0); }} aria-pressed={favorites}>
          <Heart className="w-4 h-4 mr-2" />{favorites ? 'Ver todos' : 'Favoritos'}</Button>
        <Button variant="outline" onClick={() => navigate('/cliente/onboarding')}>Editar búsqueda</Button>
        <Button variant="ghost" aria-label="Actualizar inmuebles" onClick={() => setRefresh(n => n + 1)}><RefreshCw className="w-4 h-4" /></Button>
      </div>
    </div>
    {loading ? <p role="status" className="py-10">Cargando tus recomendaciones…</p> : error ?
      <Card><CardContent className="p-6"><p role="alert">No hemos podido cargar los inmuebles.</p><Button className="mt-3" onClick={() => setRefresh(n => n + 1)}>Reintentar</Button></CardContent></Card> : !items.length ?
      <Card><CardContent className="p-8 text-center"><Home className="mx-auto mb-3 text-muted-foreground" />
        <h3 className="font-semibold">{favorites ? 'Todavía no hay favoritos' : 'Aún no hay recomendaciones para tu búsqueda'}</h3>
        <p className="text-muted-foreground mt-2">{favorites ? 'Guarda los anuncios que te interesen para encontrarlos aquí.' : 'Revisa tus criterios. Los resultados aparecerán cuando se actualicen y comparen los anuncios.'}</p>
      </CardContent></Card> :
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">{items.map(item => {
        const p = item.propiedad, link = safeUrl(p.url), image = p.imagenes?.map(safeUrl).find(Boolean);
        return <Card key={item.id} className="overflow-hidden"><div className="h-44 bg-muted flex items-center justify-center">
          {image ? <img src={image} alt={p.titulo} className="w-full h-full object-cover" loading="lazy" referrerPolicy="no-referrer" onError={e => { e.currentTarget.style.display = 'none'; }} /> : <Home className="w-12 h-12 text-muted-foreground" />}
        </div><CardContent className="p-5 space-y-3">
          <div className="flex justify-between gap-3"><h3 className="font-semibold line-clamp-2">{p.titulo}</h3>
            <Button size="icon" variant="ghost" disabled={saving === item.id} aria-label={item.favorito ? 'Quitar de favoritos' : 'Guardar favorito'} aria-pressed={item.favorito} onClick={() => toggleFavorite(item)}>
              <Heart className={item.favorito ? 'fill-primary text-primary' : ''} /></Button></div>
          <p className="text-xl font-bold">{new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(p.precio)}</p>
          <p className="text-sm">{p.ubicacion}</p>
          <p className="text-sm text-muted-foreground">{p.metros ?? '—'} m² · {p.dormitorios ?? '—'} hab. · {p.banos ?? '—'} baños</p>
          <div className="flex flex-wrap gap-1">{Object.entries(item.criterios_cumplidos ?? {}).filter(([key,value]) => labels[key] && value === true).map(([key]) => <Badge key={key} variant="secondary">{labels[key]}</Badge>)}</div>
          <p className="text-xs text-muted-foreground">{p.portal_origen} · Última comprobación: {p.last_seen ? new Date(p.last_seen).toLocaleDateString('es-ES') : 'sin fecha'}</p>
          {link && <Button asChild variant="outline" className="w-full"><a href={link} target="_blank" rel="noopener noreferrer">Ver anuncio original<ExternalLink className="w-4 h-4 ml-2" /></a></Button>}
        </CardContent></Card>;
      })}</div>}
    {!loading && <div className="flex items-center justify-center gap-3 mt-5">
      <Button variant="outline" disabled={page === 0} onClick={() => setPage(p => p-1)}>Anterior</Button>
      <span className="text-sm">Página {page + 1}</span>
      <Button variant="outline" disabled={!more || error} onClick={() => setPage(p => p+1)}>Siguiente</Button>
    </div>}
  </section>;
}
