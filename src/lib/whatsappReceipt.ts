import { formatBRL } from "@/lib/format";

export interface ReceiptItem {
  nome: string;
  sku?: string;
  kg: number;
  preco_kg: number;
}

export interface ReceiptPayment {
  data: string | Date;
  valor: number;
  rotulo?: string; // ex: "Entrada", "Quitação parcial"
}

export interface ReceiptData {
  tipo: "Venda" | "Compra" | "Pedido";
  numero?: string | number;
  data: string | Date;
  contraparte: string; // Cliente ou fornecedor
  peixaria?: string;
  itens: ReceiptItem[];
  valor_total: number;
  valor_pago: number; // Total já pago (entrada + quitações). À vista = valor_total.
  pagamentos?: ReceiptPayment[]; // Lista detalhada (opcional). Quando informada, é exibida no recibo a prazo.
}

function formatDate(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function formatShortDate(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("pt-BR");
}

export function buildReceiptText(r: ReceiptData): string {
  const debito = +(r.valor_total - r.valor_pago).toFixed(2);
  const aprazo = debito > 0.001;

  const header = aprazo
    ? `*Comprovante de ${r.tipo} a Prazo*`
    : `*Recibo de ${r.tipo}*`;

  const lines: string[] = [];
  lines.push(`🧾 ${header}`);
  if (r.peixaria) lines.push(`🏪 ${r.peixaria}`);
  lines.push("");
  if (r.numero !== undefined) lines.push(`*Nº:* ${r.numero}`);
  lines.push(`*Data:* ${formatDate(r.data)}`);
  lines.push(`*${r.tipo === "Compra" ? "Fornecedor" : "Cliente"}:* ${r.contraparte}`);
  lines.push("");
  lines.push("*Itens:*");
  for (const it of r.itens) {
    const sub = it.kg * it.preco_kg;
    lines.push(`• ${it.nome}`);
    lines.push(`   ${it.kg}kg × ${formatBRL(it.preco_kg)} = *${formatBRL(sub)}*`);
  }
  lines.push("");
  lines.push("━━━━━━━━━━━━━━━━━━");

  if (aprazo) {
    lines.push(`*Valor Total:* ${formatBRL(r.valor_total)}`);
    if (r.pagamentos && r.pagamentos.length > 0) {
      lines.push("");
      lines.push("*Pagamentos realizados:*");
      for (const p of r.pagamentos) {
        const rot = p.rotulo ? ` (${p.rotulo})` : "";
        lines.push(`• ${formatShortDate(p.data)} — ${formatBRL(p.valor)}${rot}`);
      }
      lines.push(`_Total pago: ${formatBRL(r.valor_pago)}_`);
    } else if (r.valor_pago > 0) {
      lines.push(`*Entrada paga:* ${formatBRL(r.valor_pago)}`);
    }
    lines.push("");
    lines.push(`💳 *SALDO DEVEDOR: ${formatBRL(debito)}*`);
  } else {
    if (r.pagamentos && r.pagamentos.length > 1) {
      lines.push(`*Valor Total:* ${formatBRL(r.valor_total)}`);
      lines.push("");
      lines.push("*Pagamentos realizados:*");
      for (const p of r.pagamentos) {
        const rot = p.rotulo ? ` (${p.rotulo})` : "";
        lines.push(`• ${formatShortDate(p.data)} — ${formatBRL(p.valor)}${rot}`);
      }
      lines.push("");
      lines.push(`✅ *QUITADO: ${formatBRL(r.valor_total)}*`);
    } else {
      lines.push(`✅ *TOTAL PAGO: ${formatBRL(r.valor_total)}*`);
    }
  }
  lines.push("");
  lines.push("_Obrigado pela preferência!_ 🐟");

  return lines.join("\n");
}

/** Limpa whatsapp e prefixa 55 (sem duplicar). */
export function normalizeWhatsapp(raw: string | null | undefined): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55")) return digits;
  return `55${digits}`;
}

export function openWhatsappReceipt(whatsapp: string | null | undefined, receipt: ReceiptData): boolean {
  const phone = normalizeWhatsapp(whatsapp);
  if (!phone) return false;
  const text = buildReceiptText(receipt);
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank");
  return true;
}
