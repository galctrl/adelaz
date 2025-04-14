export interface Store {
    id: number;
    name: string;
    password: string;
}

export interface Product {
    id: string | number;
    name: string;
    category: string | null;
    price: number | null;
    available: boolean;
}

export interface Order {
    id: number;
    store_id: number;
    product_id: number;
    quantity: number;
    created_at: string;
} 