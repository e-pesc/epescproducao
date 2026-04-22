import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/format";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  totalDevido: number;
  jaPago?: number;
  onConfirm: (amount: number, tipo: "total" | "parcial") => Promise<void> | void;
}

export function QuitacaoModal({ open, onOpenChange, title, totalDevido, jaPago = 0, onConfirm }: Props) {
  const saldo = useMemo(() => +(totalDevido - jaPago).toFixed(2), [totalDevido, jaPago]);
  const [tipo, setTipo] = useState<"total" | "parcial">("total");
  const [valor, setValor] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    const amount = tipo === "total" ? saldo : parseFloat(valor) || 0;
    if (amount <= 0) return;
    if (tipo === "parcial" && amount > saldo) return;
    try {
      setSubmitting(true);
      await onConfirm(amount, tipo);
      setValor("");
      setTipo("total");
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setValor(""); setTipo("total"); } onOpenChange(o); }}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-2xl bg-muted p-4 text-center">
            <p className="text-xs text-muted-foreground uppercase">Saldo devedor</p>
            <p className="text-3xl font-bold text-foreground">{formatBRL(saldo)}</p>
            {jaPago > 0 && (
              <p className="text-[11px] text-muted-foreground mt-1">
                Total: {formatBRL(totalDevido)} • Já pago: {formatBRL(jaPago)}
              </p>
            )}
          </div>

          <div>
            <Label>Tipo de Pagamento</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {(["total", "parcial"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTipo(t)}
                  className={cn(
                    "rounded-2xl py-3 text-sm font-semibold transition-colors border",
                    tipo === t
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-foreground border-border"
                  )}
                >
                  {t === "total" ? "Total" : "Parcial"}
                </button>
              ))}
            </div>
          </div>

          {tipo === "parcial" && (
            <div>
              <Label>Valor Pago (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max={saldo}
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="0,00"
                className="rounded-2xl h-12 text-lg"
              />
              {valor && (
                <p className="text-xs text-muted-foreground mt-1">
                  Restante após pagamento: {formatBRL(Math.max(0, saldo - (parseFloat(valor) || 0)))}
                </p>
              )}
            </div>
          )}

          <Button
            size="lg"
            className="w-full"
            onClick={handleConfirm}
            disabled={submitting || saldo <= 0 || (tipo === "parcial" && (!valor || parseFloat(valor) <= 0 || parseFloat(valor) > saldo))}
          >
            {submitting ? "Processando..." : tipo === "total" ? `Quitar ${formatBRL(saldo)}` : "Confirmar Pagamento"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
