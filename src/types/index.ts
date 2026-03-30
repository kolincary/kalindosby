export interface Product {
  id: string;
  code: string;
  name: string;
  packing: string;
  unit: string;
  created_at: string;
  updated_at: string;
}

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  created_at: string;
}

export interface Rack {
  id: string;
  name: string;
  code: string;
  warehouse_id: string;
  created_at: string;
}

export interface Transaction {
  id: string;
  date: string;
  time: string;
  product_id: string;
  quantity: number;
  type: 'IN' | 'OUT' | 'MOVE';
  warehouse_id: string;
  rack_id: string;
  packing?: string;
  user_id?: string;
  notes?: string;
  created_at: string;
}

export interface StockSummary {
  product_id: string;
  product_code: string;
  product_name: string;
  packing: string;
  rack_name: string;
  initial_stock: number;
  stock_in: number;
  stock_out: number;
  available_stock: number;
  warehouse_id: string;
  rack_id: string;
}

export interface DashboardStats {
  total_products: number;
  empty_stock_items: number;
  low_stock_items: number;
  total_transactions_today: number;
}