-- Renombrar columna 'barrio' a 'distrito' en metricas_barrios
ALTER TABLE public.metricas_barrios 
RENAME COLUMN barrio TO distrito;

-- Renombrar columna 'barrio' a 'distrito' en metricas_barrios_historico
ALTER TABLE public.metricas_barrios_historico 
RENAME COLUMN barrio TO distrito;

-- Comentarios para documentar el cambio
COMMENT ON COLUMN public.metricas_barrios.distrito IS 'Distrito amplio dentro de ciudades grandes (Centro, Norte, etc). Vacío para municipios pequeños';
COMMENT ON COLUMN public.metricas_barrios_historico.distrito IS 'Distrito amplio dentro de ciudades grandes (Centro, Norte, etc). Vacío para municipios pequeños';