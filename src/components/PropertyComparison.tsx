import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { money, safeHref, workspace } from "@/lib/workspace";
import type { Listing } from "./PropertyDetails";
export function PropertyComparison({
  items,
  onRemove,
}: {
  items: Listing[];
  onRemove: (id: string) => void;
}) {
  const [link, setLink] = useState(""),
    [sharing, setSharing] = useState(false);
  useEffect(() => {
    setLink("");
  }, [items]);
  if (!items.length) return null;
  const rows: [string, (p: Listing) => string | number][] = [
    ["Precio", (p) => money(p.precio)],
    ["Zona", (p) => p.ubicacion],
    ["Superficie", (p) => (p.metros == null ? "Sin datos" : `${p.metros} m²`)],
    ["Dormitorios", (p) => p.dormitorios ?? "Sin datos"],
    ["Baños", (p) => p.banos ?? "Sin datos"],
    ["Fuente", (p) => p.portal_origen],
    [
      "Observado",
      (p) =>
        p.last_seen
          ? new Date(p.last_seen).toLocaleDateString("es-ES")
          : "Sin fecha",
    ],
  ];
  async function share() {
    setSharing(true);
    try {
      const { data, error } = await workspace.rpc("create_shared_selection", {
        p_ids: items.map((p) => p.id),
      });
      if (error) throw error;
      setLink(
        `${window.location.origin}/seleccion/${(data as { token: string }).token}`,
      );
    } catch {
      toast.error("No se pudo crear el enlace");
    } finally {
      setSharing(false);
    }
  }
  async function dossier() {
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(16);
    doc.text("Findoo · Comparación de candidatos", 14, 18);
    doc.setFontSize(10);
    doc.text(
      `Preparado el ${new Date().toLocaleDateString("es-ES")}. Precios anunciados, disponibilidad por confirmar.`,
      14,
      27,
    );
    autoTable(doc, {
      startY: 34,
      head: [["Dato", ...items.map((p) => p.titulo)]],
      body: rows.map(([label, value]) => [
        label,
        ...items.map((p) => String(value(p))),
      ]),
    });
    doc.addPage();
    doc.text("Fuentes y comprobaciones pendientes", 14, 18);
    autoTable(doc, {
      startY: 26,
      head: [["Inmueble", "Fuente original"]],
      body: items.map((p) => [p.titulo, safeHref(p.url) ?? "Sin URL válida"]),
    });
    const y = (doc as any).lastAutoTable.finalY + 12;
    doc.text(
      "Revisar: disponibilidad, dirección, estado físico, documentación, cargas y gastos.",
      14,
      Math.min(y, 190),
    );
    doc.save("comparacion-findoo.pdf");
  }
  return (
    <section
      className="rounded-xl border bg-card p-4 mb-6 space-y-3"
      aria-labelledby="comparison-title"
    >
      <h3 id="comparison-title" className="font-semibold text-lg">
        Comparador · {items.length}/4
      </h3>
      {items.length < 2 ? (
        <p className="text-sm">
          Selecciona al menos otro inmueble para comparar.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left min-w-28 p-2">Dato</th>
                {items.map((p) => (
                  <th key={p.id} className="min-w-44 p-2 text-left">
                    {p.titulo}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onRemove(p.id)}
                      aria-label={`Quitar ${p.titulo} del comparador`}
                    >
                      Quitar
                    </Button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, format]) => (
                <tr className="border-t" key={label}>
                  <th className="p-2 text-left font-medium">{label}</th>
                  {items.map((p) => (
                    <td className="p-2" key={p.id}>
                      {format(p)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {items.length >= 2 && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={dossier}>
            Descargar dossier PDF
          </Button>
          <Button variant="outline" onClick={share} disabled={sharing}>
            Compartir durante 7 días
          </Button>
        </div>
      )}
      {link && (
        <div className="space-y-1">
          <p className="text-sm">
            Quien tenga el enlace verá esta selección. No incluye tus notas ni
            escenarios. Puedes revocarlo en tu cuenta.
          </p>
          <input
            className="w-full border rounded bg-background p-2 text-sm"
            aria-label="Enlace de selección"
            readOnly
            value={link}
            onFocus={(e) => e.currentTarget.select()}
          />
        </div>
      )}
    </section>
  );
}
