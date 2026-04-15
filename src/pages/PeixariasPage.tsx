import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SlideUpModal } from "@/components/SlideUpModal";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Power, Store, Search, CheckCircle2, Clock, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SettingsMenu } from "@/components/SettingsMenu";

interface Peixaria {
  id: string;
  razao_social: string;
  cpf_cnpj: string;
  proprietario: string;
  whatsapp: string;
  endereco: string;
  cidade: string;
  dia_pagamento: number;
  mensalidade: number;
  ativo: boolean;
  created_at: string;
}

interface PagamentoMensalidade {
  id: string;
  peixaria_id: string;
  mes_referencia: string;
  confirmado: boolean;
  confirmado_at: string | null;
}

function formatCpfCnpj(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return digits
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

function getCurrentMonthRef(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(ref: string): string {
  const [y, m] = ref.split("-");
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${months[parseInt(m) - 1]}/${y}`;
}

export function PeixariasPage() {
  const [peixarias, setPeixarias] = useState<Peixaria[]>([]);
  const [pagamentos, setPagamentos] = useState<PagamentoMensalidade[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editPeixaria, setEditPeixaria] = useState<Peixaria | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<Peixaria | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<Peixaria | null>(null);
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  const mesAtual = getCurrentMonthRef();

  const fetchAll = async () => {
    const [{ data: pData }, { data: pgData }] = await Promise.all([
      supabase.from("peixarias").select("*").order("razao_social"),
      supabase.from("pagamentos_mensalidade").select("*").eq("mes_referencia", mesAtual),
    ]);
    setPeixarias((pData as Peixaria[] | null) ?? []);
    setPagamentos((pgData as PagamentoMensalidade[] | null) ?? []);
  };

  useEffect(() => { fetchAll(); }, []);

  const isPago = (peixariaId: string) => {
    return pagamentos.some(p => p.peixaria_id === peixariaId && p.confirmado);
  };

  const handleConfirmPayment = async (p: Peixaria) => {
    const existing = pagamentos.find(pg => pg.peixaria_id === p.id);
    if (existing) {
      await supabase.from("pagamentos_mensalidade").update({
        confirmado: true,
        confirmado_at: new Date().toISOString(),
      }).eq("id", existing.id);
    } else {
      await supabase.from("pagamentos_mensalidade").insert({
        peixaria_id: p.id,
        mes_referencia: mesAtual,
        confirmado: true,
        confirmado_at: new Date().toISOString(),
      });
    }
    toast({ title: "Pagamento confirmado!" });
    setConfirmTarget(null);
    fetchAll();
  };

  const handleDelete = async (p: Peixaria) => {
    await supabase.from("peixarias").delete().eq("id", p.id);
    toast({ title: "Peixaria excluída" });
    fetchAll();
    setDeleteTarget(null);
  };

  const handleToggleActive = async (p: Peixaria) => {
    await supabase.from("peixarias").update({ ativo: !p.ativo }).eq("id", p.id);
    toast({ title: p.ativo ? "Peixaria desativada — usuários bloqueados" : "Peixaria reativada" });
    fetchAll();
  };

  const q = search.toLowerCase();
  const filtered = peixarias.filter(p =>
    !q || p.razao_social.toLowerCase().includes(q) || p.proprietario.toLowerCase().includes(q) || p.cidade.toLowerCase().includes(q)
  );

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Store className="w-6 h-6 text-secondary" />
          <h1 className="text-xl font-bold text-foreground">Peixarias</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button size="icon" className="rounded-full" onClick={() => { setEditPeixaria(undefined); setModalOpen(true); }}>
            <Plus className="w-5 h-5" />
          </Button>
          <SettingsMenu />
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input type="text" placeholder="Buscar peixaria..." value={search} onChange={(e) => setSearch(e.target.value)} className="rounded-2xl h-10 pl-9 text-sm" />
      </div>

      <p className="text-xs text-muted-foreground text-center">Referência: {formatMonthLabel(mesAtual)}</p>

      <div className="space-y-2">
        {filtered.map((p) => {
          const pago = isPago(p.id);
          return (
            <div key={p.id} className={cn("rounded-3xl bg-card p-4 shadow-sm", !p.ativo && "opacity-50")}>
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-foreground truncate">{p.razao_social}</p>
                  <p className="text-xs text-muted-foreground">{p.proprietario} • {p.cidade}</p>
                  <p className="text-xs text-muted-foreground">{p.cpf_cnpj || "Sem documento"}</p>
                  {p.whatsapp && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <MessageCircle className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{p.whatsapp}</span>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); window.open(`https://wa.me/55${p.whatsapp.replace(/\D/g, "")}`, '_blank'); }}
                        className="ml-1 inline-flex items-center justify-center w-6 h-6 rounded-full bg-[hsl(142,70%,45%)] hover:bg-[hsl(142,70%,38%)] transition-colors"
                      >
                        <MessageCircle className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Pgto dia {p.dia_pagamento} • Mensalidade: R$ {(p.mensalidade ?? 0).toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">{p.ativo ? "Ativa" : "Inativa"}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => { setEditPeixaria(p); setModalOpen(true); }}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleToggleActive(p)}>
                      <Power className={cn("w-4 h-4", p.ativo ? "text-fish-treated" : "text-muted-foreground")} />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeleteTarget(p)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "text-xs gap-1 rounded-full px-3",
                      pago
                        ? "text-fish-treated bg-fish-treated/10"
                        : "text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20"
                    )}
                    onClick={() => !pago && setConfirmTarget(p)}
                    disabled={pago}
                  >
                    {pago ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                    {pago ? "Pago" : "Pendente"}
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">Nenhuma peixaria cadastrada</p>
        )}
      </div>

      <PeixariaFormModal open={modalOpen} onOpenChange={setModalOpen} editPeixaria={editPeixaria} onSaved={fetchAll} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {deleteTarget?.razao_social}?</AlertDialogTitle>
            <AlertDialogDescription>Todos os dados desta peixaria serão perdidos permanentemente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && handleDelete(deleteTarget)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmTarget} onOpenChange={(o) => !o && setConfirmTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar pagamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Confirmar o recebimento da mensalidade de <strong>R$ {(confirmTarget?.mensalidade ?? 0).toFixed(2)}</strong> de{" "}
              <strong>{confirmTarget?.razao_social}</strong> referente a {formatMonthLabel(mesAtual)}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmTarget && handleConfirmPayment(confirmTarget)}>
              Sim, confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PeixariaFormModal({ open, onOpenChange, editPeixaria, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; editPeixaria?: Peixaria; onSaved: () => void;
}) {
  const { toast } = useToast();
  const [razaoSocial, setRazaoSocial] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [proprietario, setProprietario] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [endereco, setEndereco] = useState("");
  const [cidade, setCidade] = useState("");
  const [diaPagamento, setDiaPagamento] = useState("10");
  const [mensalidade, setMensalidade] = useState("0");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (open) {
      setRazaoSocial(editPeixaria?.razao_social ?? "");
      setCpfCnpj(editPeixaria?.cpf_cnpj ?? "");
      setProprietario(editPeixaria?.proprietario ?? "");
      setWhatsapp(editPeixaria?.whatsapp ?? "");
      setEndereco(editPeixaria?.endereco ?? "");
      setCidade(editPeixaria?.cidade ?? "");
      setDiaPagamento(String(editPeixaria?.dia_pagamento ?? 10));
      setMensalidade(String(editPeixaria?.mensalidade ?? 0));
      setEmail("");
      setPassword("");
    }
  }, [open, editPeixaria]);

  const handleSave = async () => {
    if (!razaoSocial.trim()) {
      toast({ title: "Preencha a razão social", variant: "destructive" });
      return;
    }

    const payload = {
      razao_social: razaoSocial.trim(),
      cpf_cnpj: cpfCnpj,
      proprietario: proprietario.trim(),
      whatsapp,
      endereco: endereco.trim(),
      cidade: cidade.trim(),
      dia_pagamento: parseInt(diaPagamento) || 10,
      mensalidade: parseFloat(mensalidade) || 0,
    };

    if (editPeixaria) {
      const { error } = await supabase.from("peixarias").update(payload).eq("id", editPeixaria.id);
      if (error) {
        toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Peixaria atualizada!" });
    } else {
      if (!email || !password) {
        toast({ title: "Preencha email e senha para o administrador", variant: "destructive" });
        return;
      }

      const { data: peixaria, error: peixError } = await supabase.from("peixarias").insert(payload).select("id").single();

      if (peixError || !peixaria) {
        toast({ title: "Erro ao criar peixaria", description: peixError?.message, variant: "destructive" });
        return;
      }

      const { data: fnData, error: fnError } = await supabase.functions.invoke("create-peixaria-admin", {
        body: {
          email,
          password,
          name: proprietario.trim() || razaoSocial.trim(),
          peixaria_id: peixaria.id,
        },
      });

      if (fnError || fnData?.error) {
        await supabase.from("peixarias").delete().eq("id", peixaria.id);
        toast({ title: "Erro ao criar admin", description: fnData?.error || fnError?.message, variant: "destructive" });
        return;
      }

      toast({ title: "Peixaria cadastrada!", description: "Admin criado com sucesso" });
    }

    onOpenChange(false);
    onSaved();
  };

  return (
    <SlideUpModal open={open} onOpenChange={onOpenChange} title={editPeixaria ? "Editar Peixaria" : "Nova Peixaria"}>
      <div className="space-y-4 mt-2">
        <div>
          <Label>Razão Social</Label>
          <Input value={razaoSocial} onChange={(e) => setRazaoSocial(e.target.value)} placeholder="Nome da empresa" className="rounded-2xl h-12" />
        </div>
        <div>
          <Label>CPF ou CNPJ</Label>
          <Input value={cpfCnpj} onChange={(e) => setCpfCnpj(formatCpfCnpj(e.target.value))} placeholder="000.000.000-00" className="rounded-2xl h-12" />
        </div>
        <div>
          <Label>Nome do Proprietário</Label>
          <Input value={proprietario} onChange={(e) => setProprietario(e.target.value)} placeholder="Nome completo" className="rounded-2xl h-12" />
        </div>
        <div>
          <Label>WhatsApp</Label>
          <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="(00) 00000-0000" className="rounded-2xl h-12" />
        </div>
        <div>
          <Label>Endereço</Label>
          <Input value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Rua, nº, bairro" className="rounded-2xl h-12" />
        </div>
        <div>
          <Label>Cidade</Label>
          <Input value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Nome da cidade" className="rounded-2xl h-12" />
        </div>
        <div>
          <Label>Dia de Pagamento</Label>
          <Input type="number" min="1" max="31" value={diaPagamento} onChange={(e) => setDiaPagamento(e.target.value)} placeholder="10" className="rounded-2xl h-12" />
        </div>
        <div>
          <Label>Valor da Mensalidade (R$)</Label>
          <Input type="number" min="0" step="0.01" value={mensalidade} onChange={(e) => setMensalidade(e.target.value)} placeholder="0.00" className="rounded-2xl h-12" />
        </div>
        {!editPeixaria && (
          <>
            <div className="pt-2 border-t border-border">
              <p className="text-sm font-semibold text-foreground mb-3">Login do Administrador</p>
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@peixaria.com" className="rounded-2xl h-12" />
            </div>
            <div>
              <Label>Senha</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" className="rounded-2xl h-12" />
            </div>
          </>
        )}
        <Button size="lg" className="w-full rounded-2xl" onClick={handleSave}>
          {editPeixaria ? "Guardar Alterações" : "Cadastrar Peixaria"}
        </Button>
      </div>
    </SlideUpModal>
  );
}
