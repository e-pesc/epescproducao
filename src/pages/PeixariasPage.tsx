import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatBRL } from "@/lib/format";

const ADMIN_ROOT_EMAIL = "root@epesc.com";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SlideUpModal } from "@/components/SlideUpModal";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Power, Store, Search, CheckCircle2, Clock, MessageCircle, Users, KeyRound, ChevronLeft, ChevronRight, Award } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SettingsMenu } from "@/components/SettingsMenu";
import type { Tables } from "@/integrations/supabase/types";

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
  vendedor_root_id: string | null;
  plano_gratuito?: boolean;
  desconto_mensalidade?: number;
  desconto_mes_referencia?: string | null;
}

interface PagamentoMensalidade {
  id: string;
  peixaria_id: string;
  mes_referencia: string;
  confirmado: boolean;
  confirmado_at: string | null;
}

type AppUser = Tables<"app_users">;

const PAYMENT_DAYS = ["5", "10", "15"] as const;
const MENSALIDADE_BASE = 59.9;
const MONTH_NAMES_FULL = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

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
  const [rootUsers, setRootUsers] = useState<AppUser[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editPeixaria, setEditPeixaria] = useState<Peixaria | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<Peixaria | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<Peixaria | null>(null);
  const [search, setSearch] = useState("");

  const now = new Date();
  const [filterMonth, setFilterMonth] = useState(now.getMonth());
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const filterRef = `${filterYear}-${String(filterMonth + 1).padStart(2, "0")}`;

  const { toast } = useToast();

  const fetchAll = async () => {
    const [{ data: pData }, { data: pgData }, { data: usersData }] = await Promise.all([
      supabase.from("peixarias").select("*").order("razao_social"),
      supabase.from("pagamentos_mensalidade").select("*"),
      supabase.from("app_users").select("*").eq("role", "root"),
    ]);
    setPeixarias((pData as Peixaria[] | null) ?? []);
    setPagamentos((pgData as PagamentoMensalidade[] | null) ?? []);
    setRootUsers((usersData as AppUser[] | null) ?? []);
  };

  useEffect(() => { fetchAll(); }, []);

  const isPagoMonth = (peixariaId: string, ref: string) => {
    // Plano Gratuito = sempre Pago automaticamente
    const peix = peixarias.find((p) => p.id === peixariaId);
    if (peix?.plano_gratuito) return true;
    return pagamentos.some(p => p.peixaria_id === peixariaId && p.mes_referencia === ref && p.confirmado);
  };

  const handleConfirmPayment = async (p: Peixaria) => {
    const existing = pagamentos.find(pg => pg.peixaria_id === p.id && pg.mes_referencia === filterRef);
    if (existing) {
      await supabase.from("pagamentos_mensalidade").update({ confirmado: true, confirmado_at: new Date().toISOString() }).eq("id", existing.id);
    } else {
      await supabase.from("pagamentos_mensalidade").insert({ peixaria_id: p.id, mes_referencia: filterRef, confirmado: true, confirmado_at: new Date().toISOString() });
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

  const prevMonth = () => { if (filterMonth === 0) { setFilterMonth(11); setFilterYear((y) => y - 1); } else setFilterMonth((m) => m - 1); };
  const nextMonth = () => { if (filterMonth === 11) { setFilterMonth(0); setFilterYear((y) => y + 1); } else setFilterMonth((m) => m + 1); };

  // Comissão por Root (mês filtrado):
  // - Sempre exibe Roots que possuem peixarias negociadas (auditoria).
  // - Comissão só é contabilizada quando desconto > 59,90 (excedente).
  // - Descontos ≤ 59,90 aparecem no histórico com comissão zerada.
  const commissions = rootUsers.map((u) => {
    const peixariasDoRoot = peixarias.filter((p) => p.vendedor_root_id === u.id && !p.plano_gratuito);
    let total = 0;
    let confirmed = 0;
    let lancamentos = 0;
    peixariasDoRoot.forEach((p) => {
      const desconto = Number(p.desconto_mensalidade ?? 0);
      const refMatch = p.desconto_mes_referencia === filterRef;
      if (!refMatch || desconto <= 0) return;
      lancamentos += 1;
      const extra = Math.max(0, desconto - MENSALIDADE_BASE);
      if (extra <= 0) return;
      total += extra;
      if (isPagoMonth(p.id, filterRef)) confirmed += extra;
    });
    return { user: u, total, confirmed, count: peixariasDoRoot.length, lancamentos };
  }).filter((c) => c.count > 0);

  const q = search.toLowerCase();
  const filtered = peixarias.filter(p =>
    !q || p.razao_social.toLowerCase().includes(q) || p.proprietario.toLowerCase().includes(q) || p.cidade.toLowerCase().includes(q)
  );

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Store className="w-6 h-6 text-secondary" />
          <h1 className="text-xl font-bold text-foreground">Painel Root</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-2xl bg-muted px-1 py-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevMonth}><ChevronLeft className="w-4 h-4" /></Button>
            <span className="text-xs font-semibold text-foreground whitespace-nowrap px-1">{MONTH_NAMES_FULL[filterMonth].slice(0, 3)} {filterYear}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextMonth}><ChevronRight className="w-4 h-4" /></Button>
          </div>
          <SettingsMenu />
        </div>
      </div>

      {commissions.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1"><Award className="w-3.5 h-3.5" /> Comissão por usuário Root — {MONTH_NAMES_FULL[filterMonth]}/{filterYear}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {commissions.map((c) => (
              <div key={c.user.id} className="rounded-3xl bg-card p-3 shadow-sm border-l-4 border-l-primary">
                <p className="font-semibold text-sm text-foreground truncate">{c.user.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {c.count} peixaria(s) negociada(s){c.lancamentos > 0 ? ` • ${c.lancamentos} desconto(s) no mês` : ""}
                </p>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Total</p>
                    <p className="text-sm font-bold text-foreground">{formatBRL(c.total)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Confirmado</p>
                    <p className="text-sm font-bold text-fish-treated">{formatBRL(c.confirmed)}</p>
                  </div>
                </div>
                {c.total === 0 && c.lancamentos > 0 && (
                  <p className="text-[10px] text-muted-foreground mt-1 italic">Descontos ≤ {formatBRL(MENSALIDADE_BASE)} — sem comissão</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <Tabs defaultValue="peixarias" className="w-full">
        <TabsList className="w-full rounded-2xl grid grid-cols-2">
          <TabsTrigger value="peixarias" className="rounded-xl text-sm gap-1.5"><Store className="w-4 h-4" /> Peixarias</TabsTrigger>
          <TabsTrigger value="roots" className="rounded-xl text-sm gap-1.5"><Users className="w-4 h-4" /> Usuários Root</TabsTrigger>
        </TabsList>

        <TabsContent value="peixarias" className="space-y-4 mt-4">
          <div className="flex items-center justify-between gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input type="text" placeholder="Buscar peixaria..." value={search} onChange={(e) => setSearch(e.target.value)} className="rounded-2xl h-10 pl-9 text-sm" />
            </div>
            <Button size="icon" className="rounded-full shrink-0" onClick={() => { setEditPeixaria(undefined); setModalOpen(true); }}>
              <Plus className="w-5 h-5" />
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">Status de pagamento: {MONTH_NAMES_FULL[filterMonth]}/{filterYear}</p>

          <div className="space-y-2">
            {filtered.map((p) => {
              const pago = isPagoMonth(p.id, filterRef);
              const vendedor = p.vendedor_root_id ? rootUsers.find((u) => u.id === p.vendedor_root_id) : null;
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
                        Pgto dia {p.dia_pagamento} • {p.plano_gratuito ? <span className="font-semibold text-fish-treated">Plano Gratuito</span> : <>Mensalidade: R$ {(p.mensalidade ?? 0).toFixed(2)}</>}
                        {!p.plano_gratuito && Number(p.desconto_mensalidade ?? 0) > 0 && p.desconto_mes_referencia === filterRef && (
                          <> • <span className="text-amber-600">Desconto {formatBRL(Number(p.desconto_mensalidade))}</span></>
                        )}
                      </p>
                      {vendedor && (
                        <p className="text-xs text-primary font-medium">Venda: {vendedor.name}</p>
                      )}
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
                          pago ? "text-fish-treated bg-fish-treated/10" : "text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20"
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
        </TabsContent>

        <TabsContent value="roots" className="mt-4">
          <RootUsersTab />
        </TabsContent>
      </Tabs>

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
              <strong>{confirmTarget?.razao_social}</strong> referente a {formatMonthLabel(filterRef)}?
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
  const { user } = useAuth();
  const isAdminRoot = user?.email?.toLowerCase() === ADMIN_ROOT_EMAIL;
  const [razaoSocial, setRazaoSocial] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [proprietario, setProprietario] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [endereco, setEndereco] = useState("");
  const [cidade, setCidade] = useState("");
  const [diaPagamento, setDiaPagamento] = useState("10");
  const [mensalidade, setMensalidade] = useState(String(MENSALIDADE_BASE));
  const [vendaNegociada, setVendaNegociada] = useState(false);
  const [vendedorRootId, setVendedorRootId] = useState<string>("");
  const [planoGratuito, setPlanoGratuito] = useState(false);
  const [desconto, setDesconto] = useState("0");
  const [rootUsersList, setRootUsersList] = useState<AppUser[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Edit-mode: admin email + reset password
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [adminUserId, setAdminUserId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [showResetField, setShowResetField] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (open) {
      setRazaoSocial(editPeixaria?.razao_social ?? "");
      setCpfCnpj(editPeixaria?.cpf_cnpj ?? "");
      setProprietario(editPeixaria?.proprietario ?? "");
      setWhatsapp(editPeixaria?.whatsapp ?? "");
      setEndereco(editPeixaria?.endereco ?? "");
      setCidade(editPeixaria?.cidade ?? "");
      const dia = String(editPeixaria?.dia_pagamento ?? 10);
      setDiaPagamento(PAYMENT_DAYS.includes(dia as typeof PAYMENT_DAYS[number]) ? dia : "10");
      const m = editPeixaria?.mensalidade ?? MENSALIDADE_BASE;
      setMensalidade(String(m));
      setVendaNegociada(!!editPeixaria?.vendedor_root_id || (m > MENSALIDADE_BASE));
      setVendedorRootId(editPeixaria?.vendedor_root_id ?? "");
      setPlanoGratuito(!!editPeixaria?.plano_gratuito);
      setDesconto(String(editPeixaria?.desconto_mensalidade ?? 0));
      setEmail("");
      setPassword("");

      // Carrega lista de Roots para o seletor
      supabase.from("app_users").select("*").eq("role", "root").eq("active", true)
        .then(({ data }) => setRootUsersList((data as AppUser[] | null) ?? []));
      setAdminEmail(null);
      setAdminUserId(null);
      setResetPassword("");
      setShowResetField(false);

      if (editPeixaria?.id) {
        supabase.functions.invoke("get-user-email", { body: { peixaria_id: editPeixaria.id } })
          .then(({ data }) => {
            setAdminEmail(data?.email ?? null);
            setAdminUserId(data?.app_user_id ?? null);
          })
          .catch(() => { setAdminEmail(null); });
      }
    }
  }, [open, editPeixaria]);

  const handleResetPassword = async () => {
    if (!adminUserId) {
      toast({ title: "Administrador não encontrado para esta peixaria", variant: "destructive" });
      return;
    }
    if (resetPassword.length < 6) {
      toast({ title: "Senha deve ter no mínimo 6 caracteres", variant: "destructive" });
      return;
    }
    setResetting(true);
    const { data, error } = await supabase.functions.invoke("update-user-password", {
      body: { app_user_id: adminUserId, new_password: resetPassword },
    });
    setResetting(false);
    if (error || data?.error) {
      toast({ title: "Erro ao resetar senha", description: data?.error || error?.message, variant: "destructive" });
      return;
    }
    toast({ title: "Senha resetada com sucesso!" });
    setResetPassword("");
    setShowResetField(false);
  };

  const handleSave = async () => {
    if (!razaoSocial.trim()) {
      toast({ title: "Preencha a razão social", variant: "destructive" });
      return;
    }

    const descontoNum = planoGratuito ? 0 : Math.max(0, parseFloat(desconto) || 0);
    // Se desconto > 0, registra o mês atual como referência (uso único). Quando edita e o desconto for limpo, zera a ref.
    const currentMonthRef = getCurrentMonthRef();
    // Preserva referência se o desconto não mudou de valor
    let descontoMesRef: string | null = editPeixaria?.desconto_mes_referencia ?? null;
    if (planoGratuito) {
      descontoMesRef = null;
    } else if (descontoNum > 0) {
      const oldDesc = Number(editPeixaria?.desconto_mensalidade ?? 0);
      // Novo desconto OU valor alterado => marca o mês atual
      if (!editPeixaria || oldDesc !== descontoNum || !descontoMesRef) {
        descontoMesRef = currentMonthRef;
      }
    } else {
      descontoMesRef = null;
    }

    const payload = {
      razao_social: razaoSocial.trim(),
      cpf_cnpj: cpfCnpj,
      proprietario: proprietario.trim(),
      whatsapp,
      endereco: endereco.trim(),
      cidade: cidade.trim(),
      dia_pagamento: parseInt(diaPagamento) || 10,
      mensalidade: planoGratuito ? 0 : (parseFloat(mensalidade) || MENSALIDADE_BASE),
      vendedor_root_id: vendaNegociada && vendedorRootId ? vendedorRootId : null,
      plano_gratuito: planoGratuito,
      desconto_mensalidade: descontoNum,
      desconto_mes_referencia: descontoMesRef,
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
        body: { email, password, name: proprietario.trim() || razaoSocial.trim(), peixaria_id: peixaria.id },
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
          <Select value={diaPagamento} onValueChange={setDiaPagamento}>
            <SelectTrigger className="rounded-2xl h-12"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PAYMENT_DAYS.map((d) => (
                <SelectItem key={d} value={d}>Dia {d.padStart(2, "0")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Valor da Mensalidade</Label>
          <Input
            type="text"
            value={planoGratuito ? "Gratuito" : formatBRL(parseFloat(mensalidade) || MENSALIDADE_BASE)}
            disabled
            readOnly
            className="rounded-2xl h-12 bg-muted"
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            Padrão: {formatBRL(MENSALIDADE_BASE)}.
          </p>
        </div>

        <div className="rounded-2xl border border-border p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Plano Gratuito</Label>
              <p className="text-[11px] text-muted-foreground">Isenta esta peixaria de mensalidade</p>
            </div>
            <input
              type="checkbox"
              checked={planoGratuito}
              onChange={(e) => {
                setPlanoGratuito(e.target.checked);
                if (e.target.checked) {
                  setDesconto("0");
                  setMensalidade("0");
                  setVendaNegociada(false);
                  setVendedorRootId("");
                } else {
                  setMensalidade(String(MENSALIDADE_BASE));
                }
              }}
              className="w-5 h-5 accent-primary"
            />
          </div>
        </div>

        {!planoGratuito && (
          <div className="rounded-2xl border border-border p-3 space-y-2">
            <Label className="text-sm">Desconto na Mensalidade (mês atual)</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={desconto}
              onChange={(e) => setDesconto(e.target.value)}
              placeholder="0.00"
              className="rounded-2xl h-12"
            />
            <p className="text-[11px] text-muted-foreground">
              Aplicação única no mês atual. Excedente acima de {formatBRL(MENSALIDADE_BASE)} é creditado como comissão do Root negociador.
            </p>
          </div>
        )}

        <div className="rounded-2xl border border-border p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Plano Negociado</Label>
              <p className="text-[11px] text-muted-foreground">Atribuir comissão a um usuário Root</p>
            </div>
            <input
              type="checkbox"
              checked={vendaNegociada}
              disabled={planoGratuito}
              onChange={(e) => {
                setVendaNegociada(e.target.checked);
                if (!e.target.checked) {
                  setVendedorRootId("");
                  setMensalidade(String(MENSALIDADE_BASE));
                }
              }}
              className="w-5 h-5 accent-primary"
            />
          </div>
          {vendaNegociada && (
            <>
              <div>
                <Label>Valor Negociado da Mensalidade (R$)</Label>
                <Input
                  type="number"
                  min={MENSALIDADE_BASE}
                  step="0.01"
                  value={mensalidade}
                  onChange={(e) => setMensalidade(e.target.value)}
                  placeholder={MENSALIDADE_BASE.toFixed(2)}
                  className="rounded-2xl h-12"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Valores acima de {formatBRL(MENSALIDADE_BASE)} geram comissão para o Root negociador.
                </p>
              </div>
              <div>
                <Label>Usuário Root (vendedor)</Label>
                <Select value={vendedorRootId} onValueChange={setVendedorRootId}>
                  <SelectTrigger className="rounded-2xl h-12"><SelectValue placeholder="Selecione o vendedor Root" /></SelectTrigger>
                  <SelectContent>
                    {rootUsersList.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>

        {editPeixaria && (
          <div className="pt-2 border-t border-border space-y-3">
            <p className="text-sm font-semibold text-foreground">Acesso do Administrador</p>
            <div className="rounded-2xl bg-muted p-3">
              <p className="text-xs text-muted-foreground">Login (e-mail) atual</p>
              <p className="text-sm font-semibold text-foreground break-all">
                {adminEmail ?? (adminUserId === null ? "Nenhum administrador encontrado" : "Carregando...")}
              </p>
            </div>
            {adminUserId && (
              !showResetField ? (
                <Button variant="outline" className="w-full rounded-2xl gap-2" onClick={() => setShowResetField(true)}>
                  <KeyRound className="w-4 h-4" /> Resetar Senha do Administrador
                </Button>
              ) : (
                <div className="space-y-2">
                  <Label>Nova Senha</Label>
                  <Input
                    type="password"
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="rounded-2xl h-12"
                  />
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1 rounded-2xl" onClick={() => { setShowResetField(false); setResetPassword(""); }}>
                      Cancelar
                    </Button>
                    <Button className="flex-1 rounded-2xl" onClick={handleResetPassword} disabled={resetting}>
                      {resetting ? "Salvando..." : "Confirmar Reset"}
                    </Button>
                  </div>
                </div>
              )
            )}
          </div>
        )}

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

// ─── Aba: Usuários Root ───
function RootUsersTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editUser, setEditUser] = useState<AppUser | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<AppUser | null>(null);

  const fetchUsers = async () => {
    const { data } = await supabase.from("app_users").select("*").eq("role", "root").order("created_at", { ascending: false });
    setUsers((data ?? []).filter((u) => u.auth_user_id !== user?.id));
  };

  useEffect(() => { fetchUsers(); }, [user]);

  const handleToggleActive = async (u: AppUser) => {
    await supabase.from("app_users").update({ active: !u.active }).eq("id", u.id);
    fetchUsers();
  };

  const handleDelete = async (u: AppUser) => {
    await supabase.from("app_users").delete().eq("id", u.id);
    toast({ title: "Usuário excluído" });
    fetchUsers();
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Outros administradores Root do sistema</p>
        <Button size="icon" className="rounded-full" onClick={() => { setEditUser(undefined); setModalOpen(true); }}>
          <Plus className="w-5 h-5" />
        </Button>
      </div>

      <div className="space-y-2">
        {users.map((u) => (
          <div key={u.id} className={cn("rounded-3xl bg-card p-4 shadow-sm", !u.active && "opacity-50")}>
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground truncate">{u.name}</p>
                <p className="text-xs text-muted-foreground">Root • {u.active ? "Ativo" : "Inativo"}</p>
                {u.cpf && <p className="text-xs text-muted-foreground">{u.cpf}</p>}
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="icon" onClick={() => { setEditUser(u); setModalOpen(true); }}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleToggleActive(u)}>
                  <Power className={cn("w-4 h-4", u.active ? "text-fish-treated" : "text-muted-foreground")} />
                </Button>
                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeleteTarget(u)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
        {users.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">Nenhum outro usuário Root</p>
        )}
      </div>

      <RootUserFormModal open={modalOpen} onOpenChange={setModalOpen} editUser={editUser} onSaved={fetchUsers} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && handleDelete(deleteTarget)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RootUserFormModal({ open, onOpenChange, editUser, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; editUser?: AppUser; onSaved: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [currentEmail, setCurrentEmail] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(editUser?.name ?? "");
      setCpf(editUser?.cpf ?? "");
      setWhatsapp(editUser?.whatsapp ?? "");
      setEmail("");
      setPassword("");
      setNewPassword("");
      setChangingPassword(false);
      setCurrentEmail(null);
      if (editUser?.id) {
        supabase.functions.invoke("get-user-email", { body: { app_user_id: editUser.id } })
          .then(({ data }) => setCurrentEmail(data?.email ?? null))
          .catch(() => setCurrentEmail(null));
      }
    }
  }, [open, editUser]);

  const handleSave = async () => {
    if (!name.trim()) return;
    if (editUser) {
      await supabase.from("app_users").update({ name: name.trim(), cpf, whatsapp }).eq("id", editUser.id);
      if (changingPassword && newPassword) {
        if (newPassword.length < 6) {
          toast({ title: "Senha deve ter no mínimo 6 caracteres", variant: "destructive" });
          return;
        }
        const { data, error } = await supabase.functions.invoke("update-user-password", {
          body: { app_user_id: editUser.id, new_password: newPassword },
        });
        if (error || data?.error) {
          toast({ title: "Erro ao alterar senha", description: data?.error || error?.message, variant: "destructive" });
          return;
        }
      }
      toast({ title: "Usuário atualizado!" });
    } else {
      if (!email || !password) {
        toast({ title: "Preencha email e senha", variant: "destructive" });
        return;
      }
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: { email, password, name: name.trim(), cpf, whatsapp, role: "root", peixaria_id: null },
      });
      if (error || data?.error) {
        toast({ title: "Erro ao cadastrar", description: data?.error || error?.message, variant: "destructive" });
        return;
      }
      toast({ title: "Usuário Root cadastrado!" });
    }
    onOpenChange(false);
    onSaved();
  };

  return (
    <SlideUpModal open={open} onOpenChange={onOpenChange} title={editUser ? "Editar Usuário Root" : "Novo Usuário Root"}>
      <div className="space-y-4 mt-2">
        <div><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" className="rounded-2xl h-12" /></div>
        <div><Label>CPF</Label><Input value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" className="rounded-2xl h-12" /></div>
        <div><Label>WhatsApp</Label><Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="(00) 00000-0000" className="rounded-2xl h-12" /></div>

        {!editUser && (
          <>
            <div><Label>Email (login)</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="root@email.com" className="rounded-2xl h-12" /></div>
            <div><Label>Senha</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" className="rounded-2xl h-12" /></div>
          </>
        )}

        {editUser && (
          <div className="space-y-3">
            <div className="rounded-2xl bg-muted p-3">
              <p className="text-xs text-muted-foreground">Login (e-mail) atual</p>
              <p className="text-sm font-semibold text-foreground break-all">{currentEmail ?? "Carregando..."}</p>
            </div>
            {!changingPassword ? (
              <Button variant="outline" className="w-full rounded-2xl" onClick={() => setChangingPassword(true)}>Alterar Senha</Button>
            ) : (
              <div>
                <Label>Nova Senha</Label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" className="rounded-2xl h-12" />
              </div>
            )}
          </div>
        )}

        <Button size="lg" className="w-full rounded-2xl" onClick={handleSave}>
          {editUser ? "Guardar Alterações" : "Cadastrar Usuário Root"}
        </Button>
      </div>
    </SlideUpModal>
  );
}
