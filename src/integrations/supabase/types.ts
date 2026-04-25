export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          amount: number | null
          created_at: string
          description: string
          entity: string
          entity_id: string
          id: string
          peixaria_id: string | null
          user_id: string
          user_name: string
        }
        Insert: {
          action: string
          amount?: number | null
          created_at?: string
          description?: string
          entity?: string
          entity_id?: string
          id?: string
          peixaria_id?: string | null
          user_id: string
          user_name?: string
        }
        Update: {
          action?: string
          amount?: number | null
          created_at?: string
          description?: string
          entity?: string
          entity_id?: string
          id?: string
          peixaria_id?: string | null
          user_id?: string
          user_name?: string
        }
        Relationships: []
      }
      app_users: {
        Row: {
          active: boolean
          auth_user_id: string | null
          cpf: string
          created_at: string
          id: string
          name: string
          peixaria_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          whatsapp: string
        }
        Insert: {
          active?: boolean
          auth_user_id?: string | null
          cpf?: string
          created_at?: string
          id?: string
          name: string
          peixaria_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          whatsapp?: string
        }
        Update: {
          active?: boolean
          auth_user_id?: string | null
          cpf?: string
          created_at?: string
          id?: string
          name?: string
          peixaria_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          whatsapp?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_users_peixaria_id_fkey"
            columns: ["peixaria_id"]
            isOneToOne: false
            referencedRelation: "peixarias"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          ativo: boolean
          cidade: string
          cpf_cnpj: string
          created_at: string
          debito: number
          endereco: string
          id: string
          nome: string
          peixaria_id: string | null
          updated_at: string
          whatsapp: string
        }
        Insert: {
          ativo?: boolean
          cidade?: string
          cpf_cnpj?: string
          created_at?: string
          debito?: number
          endereco?: string
          id?: string
          nome: string
          peixaria_id?: string | null
          updated_at?: string
          whatsapp?: string
        }
        Update: {
          ativo?: boolean
          cidade?: string
          cpf_cnpj?: string
          created_at?: string
          debito?: number
          endereco?: string
          id?: string
          nome?: string
          peixaria_id?: string | null
          updated_at?: string
          whatsapp?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_peixaria_id_fkey"
            columns: ["peixaria_id"]
            isOneToOne: false
            referencedRelation: "peixarias"
            referencedColumns: ["id"]
          },
        ]
      }
      dividas_compra: {
        Row: {
          cancelado: boolean
          cancelado_at: string | null
          cancelado_motivo: string | null
          cancelado_por: string | null
          created_at: string
          descricao: string | null
          fornecedor_id: string | null
          id: string
          kg: number | null
          mes_referencia: string | null
          peixaria_id: string | null
          preco_kg: number | null
          produto_id: string | null
          quitado: boolean
          recorrente: boolean
          valor_pago: number
          valor_total: number
          vencimento: string | null
        }
        Insert: {
          cancelado?: boolean
          cancelado_at?: string | null
          cancelado_motivo?: string | null
          cancelado_por?: string | null
          created_at?: string
          descricao?: string | null
          fornecedor_id?: string | null
          id?: string
          kg?: number | null
          mes_referencia?: string | null
          peixaria_id?: string | null
          preco_kg?: number | null
          produto_id?: string | null
          quitado?: boolean
          recorrente?: boolean
          valor_pago?: number
          valor_total: number
          vencimento?: string | null
        }
        Update: {
          cancelado?: boolean
          cancelado_at?: string | null
          cancelado_motivo?: string | null
          cancelado_por?: string | null
          created_at?: string
          descricao?: string | null
          fornecedor_id?: string | null
          id?: string
          kg?: number | null
          mes_referencia?: string | null
          peixaria_id?: string | null
          preco_kg?: number | null
          produto_id?: string | null
          quitado?: boolean
          recorrente?: boolean
          valor_pago?: number
          valor_total?: number
          vencimento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dividas_compra_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dividas_compra_peixaria_id_fkey"
            columns: ["peixaria_id"]
            isOneToOne: false
            referencedRelation: "peixarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dividas_compra_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      fornecedores: {
        Row: {
          ativo: boolean
          cidade: string
          cpf_cnpj: string
          created_at: string
          endereco: string
          id: string
          nome: string
          peixaria_id: string | null
          updated_at: string
          whatsapp: string
        }
        Insert: {
          ativo?: boolean
          cidade?: string
          cpf_cnpj?: string
          created_at?: string
          endereco?: string
          id?: string
          nome: string
          peixaria_id?: string | null
          updated_at?: string
          whatsapp?: string
        }
        Update: {
          ativo?: boolean
          cidade?: string
          cpf_cnpj?: string
          created_at?: string
          endereco?: string
          id?: string
          nome?: string
          peixaria_id?: string | null
          updated_at?: string
          whatsapp?: string
        }
        Relationships: [
          {
            foreignKeyName: "fornecedores_peixaria_id_fkey"
            columns: ["peixaria_id"]
            isOneToOne: false
            referencedRelation: "peixarias"
            referencedColumns: ["id"]
          },
        ]
      }
      itens_pedido: {
        Row: {
          id: string
          kg: number
          pedido_id: string
          peixaria_id: string | null
          preco_kg: number
          produto_id: string
        }
        Insert: {
          id?: string
          kg: number
          pedido_id: string
          peixaria_id?: string | null
          preco_kg: number
          produto_id: string
        }
        Update: {
          id?: string
          kg?: number
          pedido_id?: string
          peixaria_id?: string | null
          preco_kg?: number
          produto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "itens_pedido_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itens_pedido_peixaria_id_fkey"
            columns: ["peixaria_id"]
            isOneToOne: false
            referencedRelation: "peixarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itens_pedido_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      itens_venda: {
        Row: {
          id: string
          kg: number
          peixaria_id: string | null
          preco_kg: number
          produto_id: string
          venda_id: string
        }
        Insert: {
          id?: string
          kg: number
          peixaria_id?: string | null
          preco_kg: number
          produto_id: string
          venda_id: string
        }
        Update: {
          id?: string
          kg?: number
          peixaria_id?: string | null
          preco_kg?: number
          produto_id?: string
          venda_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "itens_venda_peixaria_id_fkey"
            columns: ["peixaria_id"]
            isOneToOne: false
            referencedRelation: "peixarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itens_venda_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itens_venda_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      movimentacoes_estoque: {
        Row: {
          created_at: string
          id: string
          kg: number
          observacao: string | null
          peixaria_id: string | null
          produto_id: string
          tipo: Database["public"]["Enums"]["movimento_tipo"]
        }
        Insert: {
          created_at?: string
          id?: string
          kg: number
          observacao?: string | null
          peixaria_id?: string | null
          produto_id: string
          tipo: Database["public"]["Enums"]["movimento_tipo"]
        }
        Update: {
          created_at?: string
          id?: string
          kg?: number
          observacao?: string | null
          peixaria_id?: string | null
          produto_id?: string
          tipo?: Database["public"]["Enums"]["movimento_tipo"]
        }
        Relationships: [
          {
            foreignKeyName: "movimentacoes_estoque_peixaria_id_fkey"
            columns: ["peixaria_id"]
            isOneToOne: false
            referencedRelation: "peixarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_estoque_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamentos_entrada: {
        Row: {
          cancelado: boolean
          cancelado_at: string | null
          cancelado_motivo: string | null
          cancelado_por: string | null
          cliente_id: string | null
          created_at: string
          id: string
          kg: number | null
          origem: string
          pedido_id: string | null
          peixaria_id: string | null
          produto_id: string | null
          tipo: string
          valor: number
          venda_id: string | null
        }
        Insert: {
          cancelado?: boolean
          cancelado_at?: string | null
          cancelado_motivo?: string | null
          cancelado_por?: string | null
          cliente_id?: string | null
          created_at?: string
          id?: string
          kg?: number | null
          origem?: string
          pedido_id?: string | null
          peixaria_id?: string | null
          produto_id?: string | null
          tipo?: string
          valor: number
          venda_id?: string | null
        }
        Update: {
          cancelado?: boolean
          cancelado_at?: string | null
          cancelado_motivo?: string | null
          cancelado_por?: string | null
          cliente_id?: string | null
          created_at?: string
          id?: string
          kg?: number | null
          origem?: string
          pedido_id?: string | null
          peixaria_id?: string | null
          produto_id?: string | null
          tipo?: string
          valor?: number
          venda_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_entrada_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_entrada_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_entrada_peixaria_id_fkey"
            columns: ["peixaria_id"]
            isOneToOne: false
            referencedRelation: "peixarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_entrada_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_entrada_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamentos_mensalidade: {
        Row: {
          confirmado: boolean
          confirmado_at: string | null
          created_at: string
          id: string
          mes_referencia: string
          peixaria_id: string
        }
        Insert: {
          confirmado?: boolean
          confirmado_at?: string | null
          created_at?: string
          id?: string
          mes_referencia: string
          peixaria_id: string
        }
        Update: {
          confirmado?: boolean
          confirmado_at?: string | null
          created_at?: string
          id?: string
          mes_referencia?: string
          peixaria_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_mensalidade_peixaria_id_fkey"
            columns: ["peixaria_id"]
            isOneToOne: false
            referencedRelation: "peixarias"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamentos_saida: {
        Row: {
          cancelado: boolean
          cancelado_at: string | null
          cancelado_motivo: string | null
          cancelado_por: string | null
          created_at: string
          descricao: string | null
          divida_id: string | null
          fornecedor_id: string | null
          id: string
          peixaria_id: string | null
          tipo: string
          valor: number
        }
        Insert: {
          cancelado?: boolean
          cancelado_at?: string | null
          cancelado_motivo?: string | null
          cancelado_por?: string | null
          created_at?: string
          descricao?: string | null
          divida_id?: string | null
          fornecedor_id?: string | null
          id?: string
          peixaria_id?: string | null
          tipo?: string
          valor: number
        }
        Update: {
          cancelado?: boolean
          cancelado_at?: string | null
          cancelado_motivo?: string | null
          cancelado_por?: string | null
          created_at?: string
          descricao?: string | null
          divida_id?: string | null
          fornecedor_id?: string | null
          id?: string
          peixaria_id?: string | null
          tipo?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_saida_divida_id_fkey"
            columns: ["divida_id"]
            isOneToOne: false
            referencedRelation: "dividas_compra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_saida_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_saida_peixaria_id_fkey"
            columns: ["peixaria_id"]
            isOneToOne: false
            referencedRelation: "peixarias"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos: {
        Row: {
          cancelado: boolean
          cancelado_at: string | null
          cancelado_motivo: string | null
          cancelado_por: string | null
          cliente_id: string
          created_at: string
          entrada: number | null
          fulfilled_at: string | null
          id: string
          numero: number
          pagamento: Database["public"]["Enums"]["pagamento_tipo"] | null
          peixaria_id: string | null
          prepaid: boolean
          prepaid_method: Database["public"]["Enums"]["prepaid_method"] | null
          status: Database["public"]["Enums"]["pedido_status"]
          valor_total: number
        }
        Insert: {
          cancelado?: boolean
          cancelado_at?: string | null
          cancelado_motivo?: string | null
          cancelado_por?: string | null
          cliente_id: string
          created_at?: string
          entrada?: number | null
          fulfilled_at?: string | null
          id?: string
          numero?: number
          pagamento?: Database["public"]["Enums"]["pagamento_tipo"] | null
          peixaria_id?: string | null
          prepaid?: boolean
          prepaid_method?: Database["public"]["Enums"]["prepaid_method"] | null
          status?: Database["public"]["Enums"]["pedido_status"]
          valor_total?: number
        }
        Update: {
          cancelado?: boolean
          cancelado_at?: string | null
          cancelado_motivo?: string | null
          cancelado_por?: string | null
          cliente_id?: string
          created_at?: string
          entrada?: number | null
          fulfilled_at?: string | null
          id?: string
          numero?: number
          pagamento?: Database["public"]["Enums"]["pagamento_tipo"] | null
          peixaria_id?: string | null
          prepaid?: boolean
          prepaid_method?: Database["public"]["Enums"]["prepaid_method"] | null
          status?: Database["public"]["Enums"]["pedido_status"]
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_peixaria_id_fkey"
            columns: ["peixaria_id"]
            isOneToOne: false
            referencedRelation: "peixarias"
            referencedColumns: ["id"]
          },
        ]
      }
      peixarias: {
        Row: {
          ativo: boolean
          cidade: string
          cpf_cnpj: string
          created_at: string
          desconto_mensalidade: number
          desconto_mes_referencia: string | null
          dia_pagamento: number
          endereco: string
          id: string
          mensalidade: number
          plano_gratuito: boolean
          proprietario: string
          razao_social: string
          updated_at: string
          vendedor_root_id: string | null
          whatsapp: string
        }
        Insert: {
          ativo?: boolean
          cidade?: string
          cpf_cnpj?: string
          created_at?: string
          desconto_mensalidade?: number
          desconto_mes_referencia?: string | null
          dia_pagamento?: number
          endereco?: string
          id?: string
          mensalidade?: number
          plano_gratuito?: boolean
          proprietario?: string
          razao_social: string
          updated_at?: string
          vendedor_root_id?: string | null
          whatsapp?: string
        }
        Update: {
          ativo?: boolean
          cidade?: string
          cpf_cnpj?: string
          created_at?: string
          desconto_mensalidade?: number
          desconto_mes_referencia?: string | null
          dia_pagamento?: number
          endereco?: string
          id?: string
          mensalidade?: number
          plano_gratuito?: boolean
          proprietario?: string
          razao_social?: string
          updated_at?: string
          vendedor_root_id?: string | null
          whatsapp?: string
        }
        Relationships: [
          {
            foreignKeyName: "peixarias_vendedor_root_id_fkey"
            columns: ["vendedor_root_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos: {
        Row: {
          ativo: boolean
          created_at: string
          estoque_kg: number
          id: string
          linked_sku: string | null
          nome: string
          peixaria_id: string | null
          preco_compra: number
          sku: string
          tipo: Database["public"]["Enums"]["produto_tipo"]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          estoque_kg?: number
          id?: string
          linked_sku?: string | null
          nome: string
          peixaria_id?: string | null
          preco_compra?: number
          sku: string
          tipo?: Database["public"]["Enums"]["produto_tipo"]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          estoque_kg?: number
          id?: string
          linked_sku?: string | null
          nome?: string
          peixaria_id?: string | null
          preco_compra?: number
          sku?: string
          tipo?: Database["public"]["Enums"]["produto_tipo"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "produtos_peixaria_id_fkey"
            columns: ["peixaria_id"]
            isOneToOne: false
            referencedRelation: "peixarias"
            referencedColumns: ["id"]
          },
        ]
      }
      vendas: {
        Row: {
          cancelado: boolean
          cancelado_at: string | null
          cancelado_motivo: string | null
          cancelado_por: string | null
          cliente_id: string | null
          created_at: string
          entrada: number | null
          forma_pagamento: Database["public"]["Enums"]["pagamento_tipo"]
          id: string
          kg: number
          peixaria_id: string | null
          preco_kg: number
          produto_id: string
          valor_total: number
          vendedor_id: string | null
        }
        Insert: {
          cancelado?: boolean
          cancelado_at?: string | null
          cancelado_motivo?: string | null
          cancelado_por?: string | null
          cliente_id?: string | null
          created_at?: string
          entrada?: number | null
          forma_pagamento?: Database["public"]["Enums"]["pagamento_tipo"]
          id?: string
          kg: number
          peixaria_id?: string | null
          preco_kg: number
          produto_id: string
          valor_total: number
          vendedor_id?: string | null
        }
        Update: {
          cancelado?: boolean
          cancelado_at?: string | null
          cancelado_motivo?: string | null
          cancelado_por?: string | null
          cliente_id?: string | null
          created_at?: string
          entrada?: number | null
          forma_pagamento?: Database["public"]["Enums"]["pagamento_tipo"]
          id?: string
          kg?: number
          peixaria_id?: string | null
          preco_kg?: number
          produto_id?: string
          valor_total?: number
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_peixaria_id_fkey"
            columns: ["peixaria_id"]
            isOneToOne: false
            referencedRelation: "peixarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_my_peixaria_id: { Args: never; Returns: string }
      get_my_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_my_peixaria_active: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "vendedor" | "administrador" | "root"
      movimento_tipo: "perda" | "quebra" | "outros" | "processamento" | "venda"
      pagamento_tipo: "avista" | "prazo"
      pedido_status: "pendente" | "atendido"
      prepaid_method: "pix" | "cartao" | "dinheiro"
      produto_tipo: "inteiro" | "tratado"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["vendedor", "administrador", "root"],
      movimento_tipo: ["perda", "quebra", "outros", "processamento", "venda"],
      pagamento_tipo: ["avista", "prazo"],
      pedido_status: ["pendente", "atendido"],
      prepaid_method: ["pix", "cartao", "dinheiro"],
      produto_tipo: ["inteiro", "tratado"],
    },
  },
} as const
