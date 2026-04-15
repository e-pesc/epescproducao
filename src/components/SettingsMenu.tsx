import { Settings, FileText, Users, LogOut, ClipboardList } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";

interface SettingsMenuProps {
  onOpenReports?: () => void;
  onOpenUsers?: () => void;
  onOpenLogs?: () => void;
}

export function SettingsMenu({ onOpenReports, onOpenUsers, onOpenLogs }: SettingsMenuProps) {
  const { signOut, role } = useAuth();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="p-2 rounded-full hover:bg-muted transition-colors">
          <Settings className="w-5 h-5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {role === "administrador" && (
          <>
            {onOpenReports && (
              <DropdownMenuItem onClick={onOpenReports}>
                <FileText className="w-4 h-4 mr-2" />
                Relatórios
              </DropdownMenuItem>
            )}
            {onOpenLogs && (
              <DropdownMenuItem onClick={onOpenLogs}>
                <ClipboardList className="w-4 h-4 mr-2" />
                Logs de Atividade
              </DropdownMenuItem>
            )}
            {onOpenUsers && (
              <DropdownMenuItem onClick={onOpenUsers}>
                <Users className="w-4 h-4 mr-2" />
                Gerenciar Usuários
              </DropdownMenuItem>
            )}
          </>
        )}
        <DropdownMenuItem onClick={signOut}>
          <LogOut className="w-4 h-4 mr-2" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
