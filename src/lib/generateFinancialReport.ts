import { supabase } from "@/integrations/supabase/client";

export interface ReportRow {
  dataHora: string;
  usuario: string;
  operacao: "Venda" | "Compra" | "Quitação Crédito" | "Quitação Débito";
  clienteFornecedor: string;
  cpfCnpj: string;
  sku: string;
  descricao: string;
  precoCompra: number;
  quantidade: number;
  valorTotal: number;
  margemLucro: number | null;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

/** Format BRL for PDF (avoids non-breaking spaces that jsPDF can't render) */
function brl(value: number | null | undefined): string {
  const num = Number(value) || 0;
  const parts = Math.abs(num).toFixed(2).split(".");
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const sign = num < 0 ? "-" : "";
  return `${sign}R$ ${intPart},${parts[1]}`;
}

export async function fetchFinancialData(startDate: string, endDate: string): Promise<ReportRow[]> {
  const start = `${startDate}T00:00:00`;
  const end = `${endDate}T23:59:59`;

  const [vendasRes, pedidosRes, dividasRes, produtosRes, usersRes, clientesRes, fornecedoresRes, logsRes, pagEntradaRes, pagSaidaRes] = await Promise.all([
    supabase.from("vendas").select("*").gte("created_at", start).lte("created_at", end),
    supabase.from("pedidos").select("*").eq("status", "atendido").gte("fulfilled_at", start).lte("fulfilled_at", end),
    supabase.from("dividas_compra").select("*").gte("created_at", start).lte("created_at", end),
    supabase.from("produtos").select("id, sku, nome, preco_compra"),
    supabase.from("app_users").select("auth_user_id, name"),
    supabase.from("clientes").select("id, nome, cpf_cnpj"),
    supabase.from("fornecedores").select("id, nome, cpf_cnpj"),
    supabase.from("activity_logs").select("entity_id, user_name, action").gte("created_at", start).lte("created_at", end),
    supabase.from("pagamentos_entrada").select("*").eq("origem", "recebimento").gte("created_at", start).lte("created_at", end),
    supabase.from("pagamentos_saida").select("*").not("divida_id", "is", null).gte("created_at", start).lte("created_at", end),
  ]);

  const vendas = vendasRes.data ?? [];
  const pedidos = pedidosRes.data ?? [];
  const dividas = dividasRes.data ?? [];
  const produtos = produtosRes.data ?? [];
  const users = usersRes.data ?? [];
  const clientes = clientesRes.data ?? [];
  const fornecedores = fornecedoresRes.data ?? [];
  const activityLogs = logsRes.data ?? [];

  const produtoMap = new Map(produtos.map(p => [p.id, p]));
  const userMap = new Map(users.map(u => [u.auth_user_id, u.name]));
  const clienteMap = new Map(clientes.map(c => [c.id, { nome: c.nome, cpf: c.cpf_cnpj }]));
  const fornecedorMap = new Map(fornecedores.map(f => [f.id, { nome: f.nome, cpf: f.cpf_cnpj }]));

  // Build a fallback map from entity_id prefix → user_name using activity_logs
  const logUserMap = new Map<string, string>();
  for (const log of activityLogs) {
    if (log.entity_id && log.user_name) {
      logUserMap.set(`${log.action}:${log.entity_id}`, log.user_name);
    }
  }

  const rows: ReportRow[] = [];

  // Fetch itens_pedido for fulfilled pedidos
  const itensPedidoMap = new Map<string, any[]>();
  if (pedidos.length > 0) {
    const pedidoIds = pedidos.map(p => p.id);
    const { data: itens } = await supabase.from("itens_pedido").select("*").in("pedido_id", pedidoIds);
    for (const item of itens ?? []) {
      const list = itensPedidoMap.get(item.pedido_id) ?? [];
      list.push(item);
      itensPedidoMap.set(item.pedido_id, list);
    }
  }

  // Fetch itens_venda for vendas
  const itensVendaMap = new Map<string, any[]>();
  if (vendas.length > 0) {
    const vendaIds = vendas.map(v => v.id);
    const { data: itens } = await supabase.from("itens_venda").select("*").in("venda_id", vendaIds);
    for (const item of itens ?? []) {
      const list = itensVendaMap.get(item.venda_id) ?? [];
      list.push(item);
      itensVendaMap.set(item.venda_id, list);
    }
  }

  // Process vendas
  for (const v of vendas) {
    const clienteInfo = clienteMap.get(v.cliente_id ?? "");
    const clienteNome = clienteInfo?.nome ?? "Consumidor";
    const clienteCpf = clienteInfo?.cpf ?? "-";
    const itensVenda = itensVendaMap.get(v.id);
    if (itensVenda && itensVenda.length > 0) {
      for (const item of itensVenda) {
        const prod = produtoMap.get(item.produto_id);
        const lineTotal = +(item.kg * item.preco_kg).toFixed(2);
        const custoTotal = prod ? +(item.kg * prod.preco_compra).toFixed(2) : 0;
        rows.push({
          dataHora: fmtDate(v.created_at),
          usuario: userMap.get(v.vendedor_id ?? "") ?? logUserMap.get(`Venda Finalizada:${v.id.slice(0, 8)}`) ?? "-",
          operacao: "Venda",
          clienteFornecedor: clienteNome,
          cpfCnpj: clienteCpf,
          sku: prod?.sku ?? "-",
          descricao: prod?.nome ?? "-",
          precoCompra: prod?.preco_compra ?? 0,
          quantidade: item.kg,
          valorTotal: lineTotal,
          margemLucro: +(lineTotal - custoTotal).toFixed(2),
        });
      }
    } else {
      const prod = produtoMap.get(v.produto_id);
      const custoTotal = prod ? +(v.kg * prod.preco_compra).toFixed(2) : 0;
      rows.push({
        dataHora: fmtDate(v.created_at),
        usuario: userMap.get(v.vendedor_id ?? "") ?? logUserMap.get(`Venda Finalizada:${v.id.slice(0, 8)}`) ?? "-",
        operacao: "Venda",
        clienteFornecedor: clienteNome,
        cpfCnpj: clienteCpf,
        sku: prod?.sku ?? "-",
        descricao: prod?.nome ?? "-",
        precoCompra: prod?.preco_compra ?? 0,
        quantidade: v.kg,
        valorTotal: v.valor_total,
        margemLucro: +(v.valor_total - custoTotal).toFixed(2),
      });
    }
  }

  // Process pedidos atendidos as "Venda"
  for (const p of pedidos) {
    const clienteInfo = clienteMap.get(p.cliente_id);
    const clienteNome = clienteInfo?.nome ?? "-";
    const clienteCpf = clienteInfo?.cpf ?? "-";
    const itens = itensPedidoMap.get(p.id) ?? [];
    for (const item of itens) {
      const prod = produtoMap.get(item.produto_id);
      const lineTotal = +(item.kg * item.preco_kg).toFixed(2);
      const custoTotal = prod ? +(item.kg * prod.preco_compra).toFixed(2) : 0;
      rows.push({
        dataHora: fmtDate(p.fulfilled_at ?? p.created_at),
        usuario: logUserMap.get(`Pedido Atendido:${p.id.slice(0, 8)}`) ?? "-",
        operacao: "Venda",
        clienteFornecedor: clienteNome,
        cpfCnpj: clienteCpf,
        sku: prod?.sku ?? "-",
        descricao: prod?.nome ?? "-",
        precoCompra: prod?.preco_compra ?? 0,
        quantidade: item.kg,
        valorTotal: lineTotal,
        margemLucro: +(lineTotal - custoTotal).toFixed(2),
      });
    }
  }

  // Process dividas_compra as "Compra" (skip cancelled)
  for (const d of dividas) {
    if (d.cancelado) continue;
    const prod = d.produto_id ? produtoMap.get(d.produto_id) : null;
    const fornecedorInfo = d.fornecedor_id ? fornecedorMap.get(d.fornecedor_id) : null;
    const fornecedorNome = fornecedorInfo?.nome ?? (d.descricao ? "Despesa" : "-");
    const fornecedorCpf = fornecedorInfo?.cpf ?? "-";
    const prodKey = d.produto_id ? d.produto_id.slice(0, 8) : "";
    const dKey = d.id ? d.id.slice(0, 8) : "";
    rows.push({
      dataHora: fmtDate(d.created_at),
      usuario:
        (prodKey && logUserMap.get(`Compra Registrada:${prodKey}`)) ||
        (dKey && logUserMap.get(`Compra Registrada:${dKey}`)) ||
        (dKey && logUserMap.get(`Despesa Lançada:${dKey}`)) ||
        "-",
      operacao: "Compra",
      clienteFornecedor: fornecedorNome,
      cpfCnpj: fornecedorCpf,
      sku: prod?.sku ?? "-",
      descricao: prod?.nome ?? d.descricao ?? "-",
      precoCompra: Number(d.preco_kg) || 0,
      quantidade: Number(d.kg) || 0,
      valorTotal: Number(d.valor_total) || 0,
      margemLucro: null,
    });
  }

  // Sort by date descending
  rows.sort((a, b) => {
    const da = a.dataHora.split(" ")[0].split("/").reverse().join("") + a.dataHora.split(" ")[1];
    const db = b.dataHora.split(" ")[0].split("/").reverse().join("") + b.dataHora.split(" ")[1];
    return db.localeCompare(da);
  });

  return rows;
}

const HEADERS = ["Data/Hora", "Usuario", "Operacao", "Cliente/Fornecedor", "CPF/CNPJ", "Código", "Descricao", "Preco Compra", "Qtd (Kg)", "Valor Total", "Margem Lucro"];

export async function generateXLS(rows: ReportRow[], startDate: string, endDate: string) {
  const XLSX = await import("xlsx");

  const data = rows.map(r => ({
    "Data/Hora": r.dataHora,
    "Usuário": r.usuario,
    "Operação": r.operacao,
    "Cliente/Fornecedor": r.clienteFornecedor,
    "CPF/CNPJ": r.cpfCnpj,
    "Código": r.sku,
    "Descrição": r.descricao,
    "Preço Compra": r.precoCompra,
    "Qtd (Kg)": r.quantidade,
    "Valor Total": r.valorTotal,
    "Margem Lucro": r.margemLucro ?? "",
  }));

  const ws = XLSX.utils.json_to_sheet(data);

  // Format currency columns (H=7, J=9, K=10)
  const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
  for (let R = range.s.r + 1; R <= range.e.r; R++) {
    for (const C of [7, 9, 10]) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      if (ws[addr] && typeof ws[addr].v === "number") {
        ws[addr].z = 'R$ #,##0.00';
      }
    }
  }

  ws["!cols"] = [
    { wch: 18 }, { wch: 20 }, { wch: 10 }, { wch: 22 }, { wch: 18 }, { wch: 12 },
    { wch: 25 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 14 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Relatorio Financeiro");
  XLSX.writeFile(wb, `relatorio_financeiro_${startDate}_${endDate}.xlsx`);
}

export async function generatePDF(rows: ReportRow[], startDate: string, endDate: string) {
  const jsPDFModule = await import("jspdf");
  const autoTableModule = await import("jspdf-autotable");
  const jsPDF = jsPDFModule.default;
  const autoTable = autoTableModule.default;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  doc.setFontSize(14);
  doc.text("Relatorio Financeiro", 14, 15);
  doc.setFontSize(10);
  doc.text(`Periodo: ${startDate.split("-").reverse().join("/")} a ${endDate.split("-").reverse().join("/")}`, 14, 22);

  const body = rows.map(r => [
    r.dataHora,
    r.usuario,
    r.operacao,
    r.clienteFornecedor,
    r.cpfCnpj,
    r.sku,
    r.descricao,
    brl(r.precoCompra),
    r.quantidade.toFixed(2),
    brl(r.valorTotal),
    r.margemLucro !== null ? brl(r.margemLucro) : "-",
  ]);

  autoTable(doc, {
    head: [HEADERS],
    body,
    startY: 28,
    styles: { fontSize: 5.5, cellPadding: 1.5 },
    headStyles: { fillColor: [41, 98, 255], fontSize: 5.5 },
    columnStyles: {
      7: { halign: "right" },
      8: { halign: "right" },
      9: { halign: "right" },
      10: { halign: "right" },
    },
    margin: { left: 6, right: 6 },
  });

  doc.save(`relatorio_financeiro_${startDate}_${endDate}.pdf`);
}

// ---- Logs de Atividade Report ----

export interface LogRow {
  dataHora: string;
  usuario: string;
  acao: string;
  entidade: string;
  entidadeId: string;
  valor: number | null;
  descricao: string;
}

export async function fetchLogsData(startDate: string, endDate: string): Promise<LogRow[]> {
  const start = `${startDate}T00:00:00`;
  const end = `${endDate}T23:59:59`;

  const { data } = await supabase
    .from("activity_logs")
    .select("*")
    .gte("created_at", start)
    .lte("created_at", end)
    .order("created_at", { ascending: false })
    .limit(1000);

  return (data ?? []).map(l => ({
    dataHora: fmtDate(l.created_at),
    usuario: l.user_name,
    acao: l.action,
    entidade: l.entity,
    entidadeId: l.entity_id,
    valor: l.amount,
    descricao: l.description,
  }));
}

const LOG_HEADERS = ["Data/Hora", "Usuario", "Acao", "Entidade", "ID", "Valor", "Descricao"];

export async function generateLogsPDF(rows: LogRow[], startDate: string, endDate: string) {
  const jsPDFModule = await import("jspdf");
  const autoTableModule = await import("jspdf-autotable");
  const jsPDF = jsPDFModule.default;
  const autoTable = autoTableModule.default;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  doc.setFontSize(14);
  doc.text("Relatorio de Logs de Atividade", 14, 15);
  doc.setFontSize(10);
  doc.text(`Periodo: ${startDate.split("-").reverse().join("/")} a ${endDate.split("-").reverse().join("/")}`, 14, 22);

  const body = rows.map(r => [
    r.dataHora,
    r.usuario,
    r.acao,
    r.entidade,
    r.entidadeId,
    r.valor != null ? brl(r.valor) : "-",
    r.descricao,
  ]);

  autoTable(doc, {
    head: [LOG_HEADERS],
    body,
    startY: 28,
    styles: { fontSize: 6, cellPadding: 1.5 },
    headStyles: { fillColor: [41, 98, 255], fontSize: 6 },
    columnStyles: {
      5: { halign: "right" },
    },
    margin: { left: 6, right: 6 },
  });

  doc.save(`relatorio_logs_${startDate}_${endDate}.pdf`);
}

export async function generateLogsXLS(rows: LogRow[], startDate: string, endDate: string) {
  const XLSX = await import("xlsx");

  const data = rows.map(r => ({
    "Data/Hora": r.dataHora,
    "Usuário": r.usuario,
    "Ação": r.acao,
    "Entidade": r.entidade,
    "ID": r.entidadeId,
    "Valor": r.valor ?? "",
    "Descrição": r.descricao,
  }));

  const ws = XLSX.utils.json_to_sheet(data);

  const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
  for (let R = range.s.r + 1; R <= range.e.r; R++) {
    const addr = XLSX.utils.encode_cell({ r: R, c: 5 });
    if (ws[addr] && typeof ws[addr].v === "number") {
      ws[addr].z = 'R$ #,##0.00';
    }
  }

  ws["!cols"] = [
    { wch: 18 }, { wch: 20 }, { wch: 22 }, { wch: 15 }, { wch: 15 }, { wch: 14 }, { wch: 50 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Logs de Atividade");
  XLSX.writeFile(wb, `relatorio_logs_${startDate}_${endDate}.xlsx`);
}
