import { useState } from "react";
import { SlideUpModal } from "@/components/SlideUpModal";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  onConfirm: (motivo: string) => Promise<void>;
}

export function CancelReasonModal({ open, onOpenChange, title, description, onConfirm }: Props) {
  const [motivo, setMotivo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = (o: boolean) => {
    if (!o) {
      setMotivo("");
      setError(null);
    }
    onOpenChange(o);
  };

  const handleConfirm = async () => {
    const trimmed = motivo.trim();
    if (trimmed.length < 3) {
      setError("Informe um motivo com pelo menos 3 caracteres");
      return;
    }
    try {
      setSubmitting(true);
      setError(null);
      await onConfirm(trimmed);
      setMotivo("");
      onOpenChange(false);
    } catch (e: any) {
      setError(e.message ?? "Erro ao cancelar");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SlideUpModal open={open} onOpenChange={handleClose} title={title}>
      <div className="space-y-4 mt-2">
        <div className="rounded-2xl bg-destructive/10 border border-destructive/30 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <p className="text-sm text-foreground">
            {description ?? "Esta ação irá estornar o estoque, marcar a entrada como cancelada e ajustar o débito do cliente. Não pode ser desfeita."}
          </p>
        </div>
        <div>
          <Label>Motivo do cancelamento <span className="text-destructive">*</span></Label>
          <Textarea
            value={motivo}
            onChange={(e) => { setMotivo(e.target.value); if (error) setError(null); }}
            placeholder="Descreva o motivo..."
            className="rounded-2xl min-h-24 mt-1"
            maxLength={500}
            disabled={submitting}
          />
          {error && <p className="text-xs text-destructive mt-1">{error}</p>}
          <p className="text-xs text-muted-foreground mt-1">{motivo.length}/500</p>
        </div>
        <Button
          size="lg"
          variant="destructive"
          className="w-full"
          onClick={handleConfirm}
          disabled={submitting}
        >
          {submitting ? "Processando..." : "Confirmar Cancelamento"}
        </Button>
      </div>
    </SlideUpModal>
  );
}
