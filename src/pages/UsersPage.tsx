import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SlideUpModal } from "@/components/SlideUpModal";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Power, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Tables } from "@/integrations/supabase/types";

type AppUser = Tables<"app_users">;

function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2}\.\d{3})(\d)/, "$1.$2")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export function UsersPage({ onBack }: { onBack?: () => void }) {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editUser, setEditUser] = useState<AppUser | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<AppUser | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchUsers = async () => {
    const { data } = await supabase.from("app_users").select("*").order("created_at", { ascending: false });
    // Filter out the current logged-in user
    const filtered = (data ?? []).filter((u) => u.auth_user_id !== user?.id);
    setUsers(filtered);
  };

  useEffect(() => { fetchUsers(); }, [user]);

  const handleDelete = async (user: AppUser) => {
    await supabase.from("app_users").delete().eq("id", user.id);
    toast({ title: "Usuário excluído" });
    fetchUsers();
    setDeleteTarget(null);
  };

  const handleToggleActive = async (user: AppUser) => {
    await supabase.from("app_users").update({ active: !user.active }).eq("id", user.id);
    fetchUsers();
  };

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {onBack && (
            <button onClick={onBack} className="p-1 rounded-full hover:bg-muted transition-colors">
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </button>
          )}
          <h1 className="text-xl font-bold text-foreground">Gerenciar Usuários</h1>
        </div>
        <Button size="icon" className="rounded-full" onClick={() => { setEditUser(undefined); setModalOpen(true); }}>
          <Plus className="w-5 h-5" />
        </Button>
      </div>

      <div className="space-y-2">
        {users.map((u) => (
          <div key={u.id} className={cn("rounded-2xl bg-card p-4 shadow-sm", !u.active && "opacity-50")}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-foreground">{u.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{u.role} • {u.active ? "Ativo" : "Inativo"}</p>
                {u.cpf && <p className="text-xs text-muted-foreground">{u.cpf}</p>}
              </div>
              <div className="flex gap-1">
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
          <p className="text-center text-sm text-muted-foreground py-8">Nenhum usuário cadastrado</p>
        )}
      </div>

      <UserFormModal open={modalOpen} onOpenChange={setModalOpen} editUser={editUser} onSaved={fetchUsers} />

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

function UserFormModal({ open, onOpenChange, editUser, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; editUser?: AppUser; onSaved: () => void;
}) {
  const { toast } = useToast();
  const { peixariaId } = useAuth();
  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [role, setRole] = useState<"vendedor" | "administrador" | "root">("vendedor");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (open) {
      setName(editUser?.name ?? "");
      setCpf(editUser?.cpf ?? "");
      setWhatsapp(editUser?.whatsapp ?? "");
      setRole(editUser?.role ?? "vendedor");
      setEmail("");
      setPassword("");
      setNewPassword("");
      setChangingPassword(false);
    }
  }, [open, editUser]);

  const handleSave = async () => {
    if (!name.trim()) return;

    if (editUser) {
      await supabase.from("app_users").update({ name: name.trim(), cpf, whatsapp, role }).eq("id", editUser.id);

      // Update password if requested
      if (changingPassword && newPassword) {
        if (newPassword.length < 6) {
          toast({ title: "Senha deve ter no mínimo 6 caracteres", variant: "destructive" });
          return;
        }
        const { data: pwData, error: pwError } = await supabase.functions.invoke("update-user-password", {
          body: { app_user_id: editUser.id, new_password: newPassword },
        });
        if (pwError || pwData?.error) {
          toast({ title: "Erro ao alterar senha", description: pwData?.error || pwError?.message, variant: "destructive" });
          return;
        }
      }

      toast({ title: "Usuário atualizado!" });
    } else {
      if (!email || !password) {
        toast({ title: "Preencha email e senha para criar o login", variant: "destructive" });
        return;
      }
      const { data: fnData, error: fnError } = await supabase.functions.invoke("create-user", {
        body: { email, password, name: name.trim(), cpf, whatsapp, role, peixaria_id: peixariaId },
      });
      if (fnError || fnData?.error) {
        toast({ title: "Erro ao cadastrar usuário", description: fnData?.error || fnError?.message, variant: "destructive" });
        return;
      }
      toast({ title: "Usuário cadastrado!" });
    }
    onOpenChange(false);
    onSaved();
  };

  return (
    <SlideUpModal open={open} onOpenChange={onOpenChange} title={editUser ? "Editar Usuário" : "Novo Usuário"}>
      <div className="space-y-4 mt-2">
        <div>
          <Label>Nome</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" className="rounded-2xl h-12" />
        </div>
        <div>
          <Label>CPF</Label>
          <Input value={cpf} onChange={(e) => setCpf(formatCpf(e.target.value))} placeholder="000.000.000-00" className="rounded-2xl h-12" />
        </div>
        <div>
          <Label>WhatsApp</Label>
          <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="(00) 00000-0000" className="rounded-2xl h-12" />
        </div>
        <div>
          <Label>Perfil</Label>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <button
              onClick={() => setRole("vendedor")}
              className={cn("rounded-2xl py-3 text-sm font-bold transition-all border", role === "vendedor" ? "bg-secondary text-secondary-foreground border-secondary" : "bg-card text-foreground border-border")}
            >
              Vendedor
            </button>
            <button
              onClick={() => setRole("administrador")}
              className={cn("rounded-2xl py-3 text-sm font-bold transition-all border", role === "administrador" ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border")}
            >
              Administrador
            </button>
          </div>
        </div>
        {!editUser && (
          <>
            <div>
              <Label>Email (login)</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="usuario@email.com" className="rounded-2xl h-12" />
            </div>
            <div>
              <Label>Senha</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" className="rounded-2xl h-12" />
            </div>
          </>
        )}
        {editUser && (
          <div>
            {!changingPassword ? (
              <Button variant="outline" className="w-full rounded-2xl" onClick={() => setChangingPassword(true)}>
                Alterar Senha
              </Button>
            ) : (
              <div>
                <Label>Nova Senha</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="rounded-2xl h-12"
                />
              </div>
            )}
          </div>
        )}
        <Button size="lg" className="w-full rounded-2xl" onClick={handleSave}>
          {editUser ? "Guardar Alterações" : "Cadastrar Usuário"}
        </Button>
      </div>
    </SlideUpModal>
  );
}
