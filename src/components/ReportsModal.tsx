import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { fetchFinancialData, generatePDF, generateXLS, fetchLogsData, generateLogsPDF, generateLogsXLS } from "@/lib/generateFinancialReport";

interface ReportsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function ReportsModal({ open, onOpenChange }: ReportsModalProps) {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const getMonthDates = (month: number, year: number) => {
    const first = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const last = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    return { first, last };
  };

  const initial = getMonthDates(now.getMonth(), now.getFullYear());
  const [startDate, setStartDate] = useState(initial.first);
  const [endDate, setEndDate] = useState(initial.last);
  const [format, setFormat] = useState("pdf");
  const [reportType, setReportType] = useState("financeiro");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const applyMonth = (month: number, year: number) => {
    setSelectedMonth(month);
    setSelectedYear(year);
    const { first, last } = getMonthDates(month, year);
    setStartDate(first);
    setEndDate(last);
  };

  const handlePrevMonth = () => {
    const newMonth = selectedMonth === 0 ? 11 : selectedMonth - 1;
    const newYear = selectedMonth === 0 ? selectedYear - 1 : selectedYear;
    applyMonth(newMonth, newYear);
  };

  const handleNextMonth = () => {
    const newMonth = selectedMonth === 11 ? 0 : selectedMonth + 1;
    const newYear = selectedMonth === 11 ? selectedYear + 1 : selectedYear;
    applyMonth(newMonth, newYear);
  };

  const handleGenerate = async () => {
    if (!startDate || !endDate) {
      toast({ title: "Preencha as datas", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      if (reportType === "financeiro") {
        const rows = await fetchFinancialData(startDate, endDate);
        if (rows.length === 0) {
          toast({ title: "Nenhum dado encontrado no período selecionado.", variant: "destructive" });
          setLoading(false);
          return;
        }
        if (format === "pdf") {
          await generatePDF(rows, startDate, endDate);
        } else {
          await generateXLS(rows, startDate, endDate);
        }
        toast({ title: `Relatório ${format.toUpperCase()} gerado com sucesso!` });
      } else {
        const logRows = await fetchLogsData(startDate, endDate);
        if (logRows.length === 0) {
          toast({ title: "Nenhum log encontrado no período selecionado.", variant: "destructive" });
          setLoading(false);
          return;
        }
        if (format === "pdf") {
          await generateLogsPDF(logRows, startDate, endDate);
        } else {
          await generateLogsXLS(logRows, startDate, endDate);
        }
        toast({ title: `Relatório de Logs ${format.toUpperCase()} gerado com sucesso!` });
      }
    } catch (err: any) {
      console.error("Report generation error:", err, err?.message, err?.stack);
      toast({ title: "Erro ao gerar relatório", description: err?.message || "Erro desconhecido", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <DialogTitle>Gerar Relatório</DialogTitle>
            <div className="flex items-center gap-1">
              <button onClick={handlePrevMonth} className="p-1 rounded-full hover:bg-muted transition-colors">
                <ChevronLeft className="w-4 h-4 text-primary" />
              </button>
              <span className="text-sm font-semibold text-primary min-w-[90px] text-center">
                {MONTH_NAMES[selectedMonth]} {selectedYear}
              </span>
              <button onClick={handleNextMonth} className="p-1 rounded-full hover:bg-muted transition-colors">
                <ChevronRight className="w-4 h-4 text-primary" />
              </button>
            </div>
          </div>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Data de Início</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded-2xl h-12" />
          </div>
          <div>
            <Label>Data de Fim</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="rounded-2xl h-12" />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <Label>Tipo de Relatório</Label>
              <RadioGroup value={reportType} onValueChange={setReportType} className="flex flex-col gap-2 mt-2">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="financeiro" id="financeiro" />
                  <Label htmlFor="financeiro" className="cursor-pointer">Financeiro</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="logs" id="logs" />
                  <Label htmlFor="logs" className="cursor-pointer">Logs de Usuário</Label>
                </div>
              </RadioGroup>
            </div>
            <div className="flex-1">
              <Label>Formato de Exportação</Label>
              <RadioGroup value={format} onValueChange={setFormat} className="flex flex-col gap-2 mt-2">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="pdf" id="pdf" />
                  <Label htmlFor="pdf" className="cursor-pointer">PDF</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="xls" id="xls" />
                  <Label htmlFor="xls" className="cursor-pointer">XLS</Label>
                </div>
              </RadioGroup>
            </div>
          </div>
          <Button className="w-full rounded-2xl h-12" onClick={handleGenerate} disabled={loading}>
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Gerando...</> : "Gerar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
