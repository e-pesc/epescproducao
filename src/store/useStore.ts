import { create } from "zustand";

export interface Product {
  id: string;
  sku: string;
  name: string;
  type: "inteiro" | "tratado";
  linkedSku?: string;
  stockKg: number;
  purchasePrice: number;
  active: boolean;
}

export interface StockMovement {
  id: string;
  productId: string;
  type: "perda" | "quebra" | "outros" | "processamento" | "venda";
  kg: number;
  observation?: string;
  createdAt: string;
}

export interface Client {
  id: string;
  name: string;
  cpfCnpj: string;
  whatsapp: string;
  address: string;
  city: string;
  active: boolean;
  debt: number;
}

export interface Supplier {
  id: string;
  name: string;
  cpfCnpj: string;
  whatsapp: string;
  address: string;
  city: string;
  active: boolean;
}

export interface OrderItem {
  productId: string;
  kg: number;
  priceKg: number;
}

export interface Order {
  id: string;
  orderNumber: number;
  clientId: string;
  items: OrderItem[];
  status: "pendente" | "atendido";
  payment?: "avista" | "prazo";
  entrada?: number;
  prepaid?: boolean;
  prepaidMethod?: "pix" | "cartao" | "dinheiro";
  totalPrice: number;
  createdAt: string;
  fulfilledAt?: string;
}

export interface Sale {
  id: string;
  productId: string;
  clientId?: string;
  kg: number;
  totalPrice: number;
  createdAt: string;
}

interface AppState {
  products: Product[];
  movements: StockMovement[];
  clients: Client[];
  suppliers: Supplier[];
  sales: Sale[];
  orders: Order[];
  addProduct: (p: Omit<Product, "id" | "active">) => void;
  deleteProduct: (id: string) => void;
  toggleProductActive: (id: string) => void;
  updateProduct: (id: string, p: Partial<Omit<Product, "id">>) => void;
  updateStock: (productId: string, deltaKg: number) => void;
  addMovement: (m: Omit<StockMovement, "id" | "createdAt">) => void;
  processProduct: (inteiroId: string, tratadoId: string, kg: number) => void;
  addClient: (c: Omit<Client, "id" | "active" | "debt">) => void;
  deleteClient: (id: string) => void;
  toggleClientActive: (id: string) => void;
  updateClient: (id: string, c: Partial<Omit<Client, "id">>) => void;
  addSupplier: (s: Omit<Supplier, "id" | "active">) => void;
  deleteSupplier: (id: string) => void;
  toggleSupplierActive: (id: string) => void;
  updateSupplier: (id: string, s: Partial<Omit<Supplier, "id">>) => void;
  addSale: (s: Omit<Sale, "id" | "createdAt">) => void;
  addOrder: (o: Omit<Order, "id" | "createdAt" | "status" | "totalPrice" | "fulfilledAt" | "orderNumber">) => void;
  updateOrder: (id: string, o: Partial<Pick<Order, "clientId" | "items">>) => void;
  fulfillOrder: (id: string, payment: "avista" | "prazo", entrada?: number) => void;
  deleteOrder: (id: string) => void;
}

const uid = () => crypto.randomUUID();

export const useStore = create<AppState>((set) => ({
  products: [
    { id: uid(), sku: "PX001", name: "Tilápia", type: "inteiro", stockKg: 50, purchasePrice: 12.5, active: true },
    { id: uid(), sku: "PX002", name: "Tilápia Filé", type: "tratado", linkedSku: "PX001", stockKg: 15, purchasePrice: 28.0, active: true },
    { id: uid(), sku: "PX003", name: "Salmão", type: "inteiro", stockKg: 30, purchasePrice: 45.0, active: true },
    { id: uid(), sku: "PX004", name: "Salmão Filé", type: "tratado", linkedSku: "PX003", stockKg: 10, purchasePrice: 75.0, active: true },
    { id: uid(), sku: "PX005", name: "Camarão", type: "inteiro", stockKg: 20, purchasePrice: 55.0, active: true },
  ],
  movements: [],
  clients: [
    { id: uid(), name: "João Silva", cpfCnpj: "", whatsapp: "11999998888", address: "Rua das Flores, 123", city: "São Paulo", active: true, debt: 0 },
  ],
  suppliers: [
    { id: uid(), name: "Pescados Norte", cpfCnpj: "", whatsapp: "11988887777", address: "Av. do Porto, 456", city: "Santos", active: true },
  ],
  sales: [],
  orders: [],

  addProduct: (p) =>
    set((s) => ({ products: [...s.products, { ...p, id: uid(), active: true }] })),

  deleteProduct: (id) =>
    set((s) => ({ products: s.products.filter((p) => p.id !== id) })),

  toggleProductActive: (id) =>
    set((s) => ({
      products: s.products.map((p) => (p.id === id ? { ...p, active: !p.active } : p)),
    })),

  updateProduct: (id, updates) =>
    set((s) => ({
      products: s.products.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    })),

  updateStock: (productId, deltaKg) =>
    set((s) => ({
      products: s.products.map((p) =>
        p.id === productId ? { ...p, stockKg: +(p.stockKg + deltaKg).toFixed(3) } : p
      ),
    })),

  addMovement: (m) =>
    set((s) => ({
      movements: [...s.movements, { ...m, id: uid(), createdAt: new Date().toISOString() }],
    })),

  processProduct: (inteiroId, tratadoId, kg) =>
    set((s) => {
      const m1: StockMovement = { id: uid(), productId: inteiroId, type: "processamento", kg, createdAt: new Date().toISOString() };
      const m2: StockMovement = { id: uid(), productId: tratadoId, type: "processamento", kg, createdAt: new Date().toISOString() };
      return {
        products: s.products.map((p) => {
          if (p.id === inteiroId) return { ...p, stockKg: Math.max(0, +(p.stockKg - kg).toFixed(3)) };
          if (p.id === tratadoId) return { ...p, stockKg: +(p.stockKg + kg).toFixed(3) };
          return p;
        }),
        movements: [...s.movements, m1, m2],
      };
    }),

  addClient: (c) =>
    set((s) => ({ clients: [...s.clients, { ...c, id: uid(), active: true, debt: 0 }] })),

  deleteClient: (id) =>
    set((s) => ({ clients: s.clients.filter((c) => c.id !== id) })),

  toggleClientActive: (id) =>
    set((s) => ({
      clients: s.clients.map((c) => (c.id === id ? { ...c, active: !c.active } : c)),
    })),

  updateClient: (id, updates) =>
    set((s) => ({
      clients: s.clients.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    })),

  addSupplier: (sup) =>
    set((s) => ({ suppliers: [...s.suppliers, { ...sup, id: uid(), active: true }] })),

  deleteSupplier: (id) =>
    set((s) => ({ suppliers: s.suppliers.filter((sup) => sup.id !== id) })),

  toggleSupplierActive: (id) =>
    set((s) => ({
      suppliers: s.suppliers.map((sup) => (sup.id === id ? { ...sup, active: !sup.active } : sup)),
    })),

  updateSupplier: (id, updates) =>
    set((s) => ({
      suppliers: s.suppliers.map((sup) => (sup.id === id ? { ...sup, ...updates } : sup)),
    })),

  addSale: (s_) =>
    set((s) => {
      const sale: Sale = { ...s_, id: uid(), createdAt: new Date().toISOString() };
      return {
        sales: [...s.sales, sale],
        products: s.products.map((p) =>
          p.id === s_.productId ? { ...p, stockKg: Math.max(0, +(p.stockKg - s_.kg).toFixed(3)) } : p
        ),
      };
    }),

  addOrder: (o) =>
    set((s) => {
      const totalPrice = o.items.reduce((acc, item) => acc + item.kg * item.priceKg, 0);
      const maxNumber = s.orders.reduce((max, ord) => Math.max(max, ord.orderNumber || 0), 0);
      const order: Order = {
        ...o,
        id: uid(),
        orderNumber: maxNumber + 1,
        status: "pendente",
        totalPrice,
        createdAt: new Date().toISOString(),
      };
      return { orders: [...s.orders, order] };
    }),

  updateOrder: (id, updates) =>
    set((s) => ({
      orders: s.orders.map((o) => {
        if (o.id !== id || o.status !== "pendente") return o;
        const updated = { ...o, ...updates };
        updated.totalPrice = updated.items.reduce((acc, item) => acc + item.kg * item.priceKg, 0);
        return updated;
      }),
    })),

  fulfillOrder: (id, payment, entrada) =>
    set((s) => {
      const order = s.orders.find((o) => o.id === id);
      if (!order || order.status !== "pendente") return s;

      // Deduct stock
      let updatedProducts = [...s.products];
      for (const item of order.items) {
        updatedProducts = updatedProducts.map((p) =>
          p.id === item.productId
            ? { ...p, stockKg: +(p.stockKg - item.kg).toFixed(3) }
            : p
        );
      }

      // Handle client debt for "a prazo" (skip if prepaid)
      let updatedClients = s.clients;
      if (!order.prepaid && payment === "prazo") {
        const debtAmount = order.totalPrice - (entrada || 0);
        updatedClients = s.clients.map((c) =>
          c.id === order.clientId ? { ...c, debt: +(c.debt + debtAmount).toFixed(2) } : c
        );
      }

      const updatedOrders = s.orders.map((o) =>
        o.id === id
          ? {
              ...o,
              status: "atendido" as const,
              payment: order.prepaid ? ("avista" as const) : payment,
              entrada: order.prepaid ? undefined : entrada,
              fulfilledAt: new Date().toISOString(),
            }
          : o
      );

      return { orders: updatedOrders, products: updatedProducts, clients: updatedClients };
    }),

  deleteOrder: (id) =>
    set((s) => ({
      orders: s.orders.filter((o) => o.id !== id),
    })),
}));
