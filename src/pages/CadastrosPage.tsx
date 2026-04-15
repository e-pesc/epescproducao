import { useState } from "react";
import { useClientes, type Cliente } from "@/hooks/useClientes";
import { useFornecedores, type Fornecedor } from "@/hooks/useFornecedores";
import { useProdutos, type Produto } from "@/hooks/useProdutos";
import { usePedidos } from "@/hooks/usePedidos";
import { useBilling } from "@/hooks/useBilling";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SlideUpModal } from "@/components/SlideUpModal";
import {
  AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Fish, Users, Truck, Plus, Phone, MapPin, Building2, Pencil, Trash2, Power, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type CadastroTab = "peixes" | "clientes" | "fornecedores";

function canDeleteProduct(product: Produto): { allowed: boolean; message: string } {
  if (product.estoque_kg !== 0) {
    return { allowed: false, message: "Não é possível excluir um produto com estoque em aberto. Zere o saldo antes de continuar." };
  }
  return { allowed: true, message: "" };
}

function canDeleteClient(clienteId: string, pedidos: any[], debito: number): { allowed: boolean; message: string } {
  const hasPendingOrders = pedidos.some((o) => o.cliente_id === clienteId && o.status === "pendente");
  if (hasPendingOrders || debito > 0) {
    return { allowed: false, message: "Este cliente possui pendências financeiras ou pedidos ativos e não pode ser removido." };
  }
  return { allowed: true, message: "" };
}

function canDeleteSupplier(fornecedorId: string, dividas: any[]): { allowed: boolean; message: string } {
  const hasOpenDebts = dividas.some((d) => d.fornecedor_id === fornecedorId && !d.quitado);
  if (hasOpenDebts) {
    return { allowed: false, message: "Existe uma fatura pendente para este fornecedor. Quite os débitos antes de excluir." };
  }
  return { allowed: true, message: "" };
}

// ─── Product Form Modal ───
function ProductFormModal({ open, onOpenChange, editProduct, produtos, addProduto, updateProduto }: {
  open: boolean; onOpenChange: (o: boolean) => void; editProduct?: Produto; produtos: Produto[];
  addProduto: (p: { sku: string; nome: string; tipo: "inteiro" | "tratado"; linked_sku?: string }) => Promise<void>;
  updateProduto: (id: string, p: Partial<Produto>) => Promise<void>;
}) {
  const { toast } = useToast();
  const inteiros = produtos.filter((p) => p.tipo === "inteiro");
  const [sku, setSku] = useState(editProduct?.sku ?? "");
  const [nome, setNome] = useState(editProduct?.nome ?? "");
  const [tipo, setTipo] = useState<"inteiro" | "tratado">(editProduct?.tipo ?? "inteiro");
  const [linkedSku, setLinkedSku] = useState(editProduct?.linked_sku ?? "");

  const handleSave = async () => {
    console.log("handleSave called", { sku, nome, tipo, linkedSku });
    if (!sku.trim() || !nome.trim()) {
      toast({ title: "Preencha todos os campos", description: "Código e Nome são obrigatórios.", variant: "destructive" });
      return;
    }
    try {
      if (editProduct) {
        await updateProduto(editProduct.id, { sku: sku.trim(), nome: nome.trim(), tipo, linked_sku: tipo === "tratado" ? linkedSku : null });
        toast({ title: "Produto atualizado!" });
      } else {
        await addProduto({ sku: sku.trim(), nome: nome.trim(), tipo, linked_sku: tipo === "tratado" ? linkedSku : undefined });
        toast({ title: "Produto cadastrado!" });
      }
      onOpenChange(false);
    } catch (e: any) {
      console.error("handleSave error", e);
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    }
  };

  return (
    <SlideUpModal open={open} onOpenChange={onOpenChange} title={editProduct ? "Editar Produto" : "Novo Produto"}>
      <div className="space-y-4 mt-2">
        <div>
          <Label className="text-sm font-semibold">Tipo</Label>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <button onClick={() => setTipo("inteiro")} className={cn("rounded-2xl py-3 text-sm font-bold transition-all border", tipo === "inteiro" ? "bg-fish-whole text-primary-foreground border-fish-whole" : "bg-card text-foreground border-border")}>🐟 Inteiro</button>
            <button onClick={() => setTipo("tratado")} className={cn("rounded-2xl py-3 text-sm font-bold transition-all border", tipo === "tratado" ? "bg-fish-treated text-primary-foreground border-fish-treated" : "bg-card text-foreground border-border")}>🔪 Tratado</button>
          </div>
        </div>
        {tipo === "tratado" && (
          <div>
            <Label>Matéria-prima (Código Inteiro)</Label>
            <select value={linkedSku} onChange={(e) => setLinkedSku(e.target.value)} className="w-full mt-1 h-12 rounded-2xl border border-input bg-background px-4 text-sm">
              <option value="">Selecionar...</option>
              {inteiros.map((p) => <option key={p.sku} value={p.sku}>{p.sku} — {p.nome}</option>)}
            </select>
          </div>
        )}
        <div><Label>Código</Label><Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="PX006" className="rounded-2xl h-12" /></div>
        <div><Label>Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do produto" className="rounded-2xl h-12" /></div>
        <Button size="lg" className="w-full" onClick={handleSave}>{editProduct ? "Guardar Alterações" : "Cadastrar Produto"}</Button>
      </div>
    </SlideUpModal>
  );
}

// ─── Person Form Modal ───
function PersonFormModal({ open, onOpenChange, personType, editPerson, addCliente, updateCliente, addFornecedor, updateFornecedor }: {
  open: boolean; onOpenChange: (o: boolean) => void; personType: "cliente" | "fornecedor"; editPerson?: Cliente | Fornecedor;
  addCliente: (c: Omit<Cliente, "id" | "ativo" | "debito" | "created_at" | "peixaria_id">) => Promise<void>;
  updateCliente: (id: string, c: Partial<Cliente>) => Promise<void>;
  addFornecedor: (f: Omit<Fornecedor, "id" | "ativo" | "created_at" | "peixaria_id">) => Promise<void>;
  updateFornecedor: (id: string, f: Partial<Fornecedor>) => Promise<void>;
}) {
  const { toast } = useToast();
  const [nome, setNome] = useState(editPerson?.nome ?? "");
  const [cpfCnpj, setCpfCnpj] = useState(editPerson?.cpf_cnpj ?? "");
  const [whatsapp, setWhatsapp] = useState(editPerson?.whatsapp ?? "");
  const [endereco, setEndereco] = useState(editPerson?.endereco ?? "");
  const [cidade, setCidade] = useState(editPerson?.cidade ?? "");
  const label = personType === "cliente" ? "Cliente" : "Fornecedor";

  const formatCpfCnpj = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 14);
    if (digits.length <= 11) {
      return digits.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    }
    return digits.replace(/(\d{2})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1/$2").replace(/(\d{4})(\d{1,2})$/, "$1-$2");
  };

  const handleSave = async () => {
    console.log("PersonFormModal handleSave called", { nome, personType });
    if (!nome.trim()) {
      toast({ title: "Preencha o nome", variant: "destructive" });
      return;
    }
    const data = { nome: nome.trim(), cpf_cnpj: cpfCnpj.trim(), whatsapp: whatsapp.trim(), endereco: endereco.trim(), cidade: cidade.trim() };
    try {
      if (editPerson) {
        personType === "cliente" ? await updateCliente(editPerson.id, data) : await updateFornecedor(editPerson.id, data);
        toast({ title: `${label} atualizado!` });
      } else {
        personType === "cliente" ? await addCliente(data) : await addFornecedor(data);
        toast({ title: `${label} adicionado!` });
      }
      onOpenChange(false);
    } catch (e: any) {
      console.error("PersonFormModal handleSave error", e);
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    }
  };

  return (
    <SlideUpModal open={open} onOpenChange={onOpenChange} title={editPerson ? `Editar ${label}` : `Novo ${label}`}>
      <div className="space-y-4 mt-2">
        <div><Label>Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder={`Nome do ${label.toLowerCase()}`} className="rounded-2xl h-12" /></div>
        <div><Label>CPF/CNPJ</Label><Input value={cpfCnpj} onChange={(e) => setCpfCnpj(formatCpfCnpj(e.target.value))} placeholder="000.000.000-00" className="rounded-2xl h-12" /></div>
        <div><Label>WhatsApp</Label><Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="11999998888" className="rounded-2xl h-12" /></div>
        <div><Label>Endereço</Label><Input value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Rua, nº, bairro" className="rounded-2xl h-12" /></div>
        <div><Label>Cidade</Label><Input value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Nome da cidade" className="rounded-2xl h-12" /></div>
        <Button size="lg" className="w-full" onClick={handleSave}>{editPerson ? "Guardar Alterações" : `Adicionar ${label}`}</Button>
      </div>
    </SlideUpModal>
  );
}

// ─── Person Card ───
function PersonCard({ person, personType, onEdit, onDelete, onToggle, deleteCheck }: {
  person: Cliente | Fornecedor; personType: "cliente" | "fornecedor"; onEdit: () => void; onDelete: () => void; onToggle: () => void;
  deleteCheck: { allowed: boolean; message: string };
}) {
  const { toast } = useToast();
  const [alertOpen, setAlertOpen] = useState(false);
  const label = personType === "cliente" ? "cliente" : "fornecedor";
  const client = personType === "cliente" ? (person as Cliente) : null;

  const handleDelete = () => {
    if (!deleteCheck.allowed) { setAlertOpen(true); return; }
    if (confirm(`Excluir este ${label}?`)) { onDelete(); toast({ title: `${label} excluído` }); }
  };

  return (
    <>
      <div className={cn("rounded-3xl bg-card p-4 shadow-sm flex items-start justify-between", !person.ativo && "opacity-50")}>
        <div>
          <h3 className="font-bold text-foreground">
            {person.nome} {!person.ativo && <span className="text-xs text-muted-foreground">(inativo)</span>}
          </h3>
          <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground"><Phone className="w-3.5 h-3.5" />{person.whatsapp || "—"}</div>
          <div className="flex items-center gap-1 mt-0.5 text-sm text-muted-foreground"><MapPin className="w-3.5 h-3.5" />{person.endereco || "—"}</div>
          <div className="flex items-center gap-1 mt-0.5 text-sm text-muted-foreground"><Building2 className="w-3.5 h-3.5" />{person.cidade || "—"}</div>
          {client && client.debito > 0 && (
            <p className="text-xs font-semibold text-destructive mt-1">Débito: R$ {Number(client.debito).toFixed(2)}</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => { onToggle(); toast({ title: person.ativo ? `${label} desativado` : `${label} ativado` }); }}>
            <Power className={cn("w-4 h-4", person.ativo ? "text-fish-treated" : "text-muted-foreground")} />
          </Button>
          <Button variant="ghost" size="icon" onClick={onEdit}><Pencil className="w-4 h-4" /></Button>
          <Button variant="ghost" size="icon" onClick={handleDelete} className={cn(!deleteCheck.allowed && "opacity-40")}>
            <Trash2 className={cn("w-4 h-4", deleteCheck.allowed ? "text-destructive" : "text-muted-foreground")} />
          </Button>
        </div>
      </div>
      <AlertDialog open={alertOpen} onOpenChange={setAlertOpen}>
        <AlertDialogContent className="rounded-3xl max-w-[90vw]">
          <AlertDialogHeader>
            <AlertDialogTitle>Exclusão bloqueada</AlertDialogTitle>
            <AlertDialogDescription>{deleteCheck.message}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setAlertOpen(false)}>Entendi</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function CadastrosPage() {
  const { produtos, addProduto, updateProduto, deleteProduto, toggleProduto } = useProdutos();
  const { clientes, addCliente, updateCliente, deleteCliente, toggleCliente } = useClientes();
  const { fornecedores, addFornecedor, updateFornecedor, deleteFornecedor, toggleFornecedor } = useFornecedores();
  const { pedidos } = usePedidos();
  const { dividasCompra } = useBilling();
  const { toast } = useToast();
  const [tab, setTab] = useState<CadastroTab>("peixes");
  const [productFormOpen, setProductFormOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Produto | undefined>();
  const [personFormOpen, setPersonFormOpen] = useState(false);
  const [editPerson, setEditPerson] = useState<Cliente | Fornecedor | undefined>();
  const [productAlert, setProductAlert] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const openNewProduct = () => { setEditProduct(undefined); setProductFormOpen(true); };
  const openEditProduct = (p: Produto) => { setEditProduct(p); setProductFormOpen(true); };
  const openNewPerson = () => { setEditPerson(undefined); setPersonFormOpen(true); };
  const openEditPerson = (p: Cliente | Fornecedor) => { setEditPerson(p); setPersonFormOpen(true); };

  const handleDeleteProduct = async (p: Produto) => {
    const check = canDeleteProduct(p);
    if (!check.allowed) { setProductAlert(check.message); return; }
    if (confirm("Excluir?")) {
      try { await deleteProduto(p.id); toast({ title: "Produto excluído" }); }
      catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); }
    }
  };

  const q = search.toLowerCase();
  const inteiros = produtos.filter((p) => p.tipo === "inteiro" && (!q || p.nome.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)));
  const tratados = produtos.filter((p) => p.tipo === "tratado" && (!q || p.nome.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)));
  const filteredClients = clientes.filter((c) => !q || c.nome.toLowerCase().includes(q) || c.cidade.toLowerCase().includes(q) || c.whatsapp.includes(q));
  const filteredSuppliers = fornecedores.filter((s) => !q || s.nome.toLowerCase().includes(q) || s.cidade.toLowerCase().includes(q) || s.whatsapp.includes(q));

  const tabIcons = { peixes: Fish, clientes: Users, fornecedores: Truck };
  const TabIcon = tabIcons[tab];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TabIcon className="w-6 h-6 text-secondary" />
          <h1 className="text-xl font-bold text-foreground">Cadastros</h1>
        </div>
        <Button size="sm" onClick={tab === "peixes" ? openNewProduct : openNewPerson}>
          <Plus className="w-4 h-4" />Novo
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {([["peixes", "Peixes"], ["clientes", "Clientes"], ["fornecedores", "Fornecedores"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={cn("rounded-2xl py-2.5 text-xs font-semibold transition-colors border",
              tab === key ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border"
            )}>{label}</button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder={tab === "peixes" ? "Buscar por nome ou código..." : "Buscar por nome, cidade ou telefone..."}
          value={search} onChange={(e) => setSearch(e.target.value)}
          className="rounded-2xl h-10 pl-9 text-sm"
        />
      </div>

      {tab === "peixes" && (
        <div className="space-y-3">
          {inteiros.length > 0 && <h2 className="text-sm font-semibold text-fish-whole">🐟 Inteiro ({inteiros.length})</h2>}
          {inteiros.map((p) => {
            const check = canDeleteProduct(p);
            return (
              <div key={p.id} className={cn("rounded-3xl bg-card p-4 shadow-sm border-l-4 border-l-fish-whole flex items-center justify-between", !p.ativo && "opacity-50")}>
                <div>
                  <h3 className="font-bold text-foreground">{p.nome} {!p.ativo && <span className="text-xs text-muted-foreground">(inativo)</span>}</h3>
                   <p className="text-xs text-muted-foreground">Código: {p.sku} · {Number(p.estoque_kg).toFixed(1)} kg</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={async () => { await toggleProduto(p.id, p.ativo); toast({ title: p.ativo ? "Produto desativado" : "Produto ativado" }); }}><Power className={cn("w-4 h-4", p.ativo ? "text-fish-treated" : "text-muted-foreground")} /></Button>
                  <Button variant="ghost" size="icon" onClick={() => openEditProduct(p)}><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteProduct(p)} className={cn(!check.allowed && "opacity-40")}>
                    <Trash2 className={cn("w-4 h-4", check.allowed ? "text-destructive" : "text-muted-foreground")} />
                  </Button>
                </div>
              </div>
            );
          })}
          {tratados.length > 0 && <h2 className="text-sm font-semibold text-fish-treated pt-1">🔪 Tratado ({tratados.length})</h2>}
          {tratados.map((p) => {
            const check = canDeleteProduct(p);
            return (
              <div key={p.id} className={cn("rounded-3xl bg-card p-4 shadow-sm border-l-4 border-l-fish-treated flex items-center justify-between", !p.ativo && "opacity-50")}>
                <div>
                  <h3 className="font-bold text-foreground">{p.nome} {!p.ativo && <span className="text-xs text-muted-foreground">(inativo)</span>}</h3>
                  <p className="text-xs text-muted-foreground">Código: {p.sku} · {Number(p.estoque_kg).toFixed(1)} kg</p>
                  {p.linked_sku && <p className="text-[10px] text-muted-foreground">Origem: {p.linked_sku}</p>}
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={async () => { await toggleProduto(p.id, p.ativo); toast({ title: p.ativo ? "Produto desativado" : "Produto ativado" }); }}><Power className={cn("w-4 h-4", p.ativo ? "text-fish-treated" : "text-muted-foreground")} /></Button>
                  <Button variant="ghost" size="icon" onClick={() => openEditProduct(p)}><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteProduct(p)} className={cn(!check.allowed && "opacity-40")}>
                    <Trash2 className={cn("w-4 h-4", check.allowed ? "text-destructive" : "text-muted-foreground")} />
                  </Button>
                </div>
              </div>
            );
          })}
          {produtos.length === 0 && <div className="text-center py-12 text-muted-foreground"><Fish className="w-12 h-12 mx-auto mb-3 opacity-30" /><p className="text-sm">Nenhum produto cadastrado</p></div>}
        </div>
      )}

      <ProductFormModal key={editProduct?.id ?? "new"} open={productFormOpen} onOpenChange={setProductFormOpen} editProduct={editProduct} produtos={produtos} addProduto={addProduto} updateProduto={updateProduto} />

      {tab === "clientes" && (
        <div className="space-y-3">
          {filteredClients.map((c) => (
            <PersonCard key={c.id} person={c} personType="cliente"
              onEdit={() => openEditPerson(c)}
              onDelete={async () => { try { await deleteCliente(c.id); } catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); } }}
              onToggle={() => toggleCliente(c.id, c.ativo)}
              deleteCheck={canDeleteClient(c.id, pedidos, Number(c.debito))}
            />
          ))}
          {clientes.length === 0 && <div className="text-center py-12 text-muted-foreground"><Users className="w-12 h-12 mx-auto mb-3 opacity-30" /><p className="text-sm">Nenhum cliente cadastrado</p></div>}
          {personFormOpen && <PersonFormModal key={editPerson?.id ?? "new"} open={personFormOpen} onOpenChange={setPersonFormOpen} personType="cliente" editPerson={editPerson} addCliente={addCliente} updateCliente={updateCliente} addFornecedor={addFornecedor} updateFornecedor={updateFornecedor} />}
        </div>
      )}

      {tab === "fornecedores" && (
        <div className="space-y-3">
          {filteredSuppliers.map((s) => (
            <PersonCard key={s.id} person={s} personType="fornecedor"
              onEdit={() => openEditPerson(s)}
              onDelete={async () => { try { await deleteFornecedor(s.id); } catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); } }}
              onToggle={() => toggleFornecedor(s.id, s.ativo)}
              deleteCheck={canDeleteSupplier(s.id, dividasCompra)}
            />
          ))}
          {fornecedores.length === 0 && <div className="text-center py-12 text-muted-foreground"><Truck className="w-12 h-12 mx-auto mb-3 opacity-30" /><p className="text-sm">Nenhum fornecedor cadastrado</p></div>}
          {personFormOpen && <PersonFormModal key={editPerson?.id ?? "new"} open={personFormOpen} onOpenChange={setPersonFormOpen} personType="fornecedor" editPerson={editPerson} addCliente={addCliente} updateCliente={updateCliente} addFornecedor={addFornecedor} updateFornecedor={updateFornecedor} />}
        </div>
      )}

      <AlertDialog open={!!productAlert} onOpenChange={(o) => !o && setProductAlert(null)}>
        <AlertDialogContent className="rounded-3xl max-w-[90vw]">
          <AlertDialogHeader>
            <AlertDialogTitle>Exclusão bloqueada</AlertDialogTitle>
            <AlertDialogDescription>{productAlert}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setProductAlert(null)}>Entendi</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
