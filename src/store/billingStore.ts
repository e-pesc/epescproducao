import { create } from "zustand";
import { useStore } from "./useStore";

export interface PurchaseDebt {
  id: string;
  supplierId: string;
  productId: string;
  kg: number;
  pricePerKg: number;
  totalPrice: number;
  paidAmount: number;
  settled: boolean;
  createdAt: string;
}

export interface PaymentOut {
  id: string;
  purchaseDebtId: string;
  supplierId: string;
  amount: number;
  type: "total" | "adiantamento";
  createdAt: string;
}

export interface PaymentIn {
  id: string;
  clientId?: string;
  origin: "venda" | "pedido" | "recebimento";
  orderId?: string;
  productId?: string;
  kg?: number;
  amount: number;
  type: "total" | "parcial";
  createdAt: string;
}

interface BillingState {
  purchaseDebts: PurchaseDebt[];
  paymentsOut: PaymentOut[];
  paymentsIn: PaymentIn[];
  addPurchaseDebt: (d: Omit<PurchaseDebt, "id" | "createdAt" | "totalPrice" | "paidAmount" | "settled">) => void;
  payDebt: (debtId: string, amount: number, type: "total" | "adiantamento") => void;
  receiveFromClient: (clientId: string, amount: number, type: "total" | "parcial") => void;
  addPaymentIn: (p: Omit<PaymentIn, "id" | "createdAt">) => void;
  addPaymentOut: (p: Omit<PaymentOut, "id" | "createdAt">) => void;
}

const uid = () => crypto.randomUUID();

export const useBillingStore = create<BillingState>((set) => ({
  purchaseDebts: [],
  paymentsOut: [],
  paymentsIn: [],

  addPurchaseDebt: (d) =>
    set((s) => ({
      purchaseDebts: [
        ...s.purchaseDebts,
        {
          ...d,
          id: uid(),
          totalPrice: +(d.kg * d.pricePerKg).toFixed(2),
          paidAmount: 0,
          settled: false,
          createdAt: new Date().toISOString(),
        },
      ],
    })),

  payDebt: (debtId, amount, type) =>
    set((s) => {
      const debt = s.purchaseDebts.find((d) => d.id === debtId);
      if (!debt) return s;

      const newPaid = +(debt.paidAmount + amount).toFixed(2);
      const settled = type === "total" || newPaid >= debt.totalPrice;

      return {
        purchaseDebts: s.purchaseDebts.map((d) =>
          d.id === debtId ? { ...d, paidAmount: newPaid, settled } : d
        ),
        paymentsOut: [
          ...s.paymentsOut,
          {
            id: uid(),
            purchaseDebtId: debtId,
            supplierId: debt.supplierId,
            amount,
            type,
            createdAt: new Date().toISOString(),
          },
        ],
      };
    }),

  receiveFromClient: (clientId, amount, type) =>
    set((s) => {
      // Also update client debt in main store
      const mainStore = useStore.getState();
      const client = mainStore.clients.find((c) => c.id === clientId);
      if (client) {
        const newDebt = type === "total" ? 0 : Math.max(0, +(client.debt - amount).toFixed(2));
        mainStore.updateClient(clientId, { debt: newDebt });
      }

      return {
        paymentsIn: [
          ...s.paymentsIn,
          {
            id: uid(),
            clientId,
            origin: "recebimento",
            amount,
            type,
            createdAt: new Date().toISOString(),
          },
        ],
      };
    }),

  addPaymentIn: (p) =>
    set((s) => ({
      paymentsIn: [...s.paymentsIn, { ...p, id: uid(), createdAt: new Date().toISOString() }],
    })),

  addPaymentOut: (p) =>
    set((s) => ({
      paymentsOut: [...s.paymentsOut, { ...p, id: uid(), createdAt: new Date().toISOString() }],
    })),
}));
