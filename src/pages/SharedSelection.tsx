import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { workspace, money, safeHref } from "@/lib/workspace";
import type { Listing } from "@/components/PropertyDetails";
export default function SharedSelection() {
  const { token } = useParams(),
    [items, setItems] = useState<Listing[] | null>(null),
    [status, setStatus] = useState("Cargando selección…");
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!token || !/^[a-f0-9]{64}$/.test(token)) throw new Error();
      const { data, error } = await workspace.rpc("read_shared_selection", {
        p_token: token,
      });
      if (error || !data) throw new Error();
      if (!cancelled) setItems((data as unknown as { items: Listing[] }).items);
    })().catch(() => {
      if (!cancelled)
        setStatus(
          "Esta selección ha caducado, se ha revocado o no está disponible.",
        );
    });
    return () => {
      cancelled = true;
    };
  }, [token]);
  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-8 space-y-6">
      <Link to="/" className="font-semibold">
        Findoo
      </Link>
      <h1 className="text-3xl font-bold">Selección compartida</h1>
      <p className="text-muted-foreground">
        Una instantánea de los anuncios al compartir. Confirma precio y
        disponibilidad en la fuente.
      </p>
      {!items ? (
        <p role="status">{status}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="p-3 text-left">Vivienda</th>
                <th className="p-3 text-right">Precio</th>
                <th className="p-3">Superficie</th>
                <th className="p-3">Habitaciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="p-3 min-w-48">
                    <a
                      className="underline"
                      href={safeHref(p.url)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {p.titulo}
                    </a>
                    <p>{p.ubicacion}</p>
                  </td>
                  <td className="p-3 text-right">{money(p.precio)}</td>
                  <td className="p-3">{p.metros ?? "—"} m²</td>
                  <td className="p-3">{p.dormitorios ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
