'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Product } from '@/types';

interface StoreResponse {
  name: string;
}

interface OrderDetails {
  id: number;
  store_id: number;
  status: string;
  store: StoreResponse;
  items: OrderItem[];
}

interface OrderItem {
  product_id: number;
  quantity: number;
  fulfilled_quantity?: number;
}

export default function OrderDetailsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const router = useRouter();
  const params = useParams();
  const orderId = params?.id as string;

  useEffect(() => {
    const storeId = localStorage.getItem('storeId');
    if (!storeId) {
      router.push('/');
      return;
    }
    
    if (orderId) {
      fetchOrderDetails();
      fetchProducts();
    }
  }, [orderId]);

  const fetchOrderDetails = async () => {
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select(`
        id,
        store_id,
        status,
        store:stores!inner(name)
      `)
      .eq('id', orderId)
      .single();

    if (orderData) {
      const { data: itemsData } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId);

      if (itemsData) {
        const transformedOrderData: OrderDetails = {
          ...orderData,
          store: { name: (orderData.store as any).name },
          items: itemsData
        };
        
        setOrderDetails(transformedOrderData);
      }
    }
  };

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name');

    if (data) {
      setProducts(data);
    }
  };

  const renderContent = () => {
    // Group products by category
    const groupedProducts = products.reduce((acc, product) => {
      if (product.category && orderDetails?.items.some(item => item.product_id === product.id)) {
        if (!acc[product.category]) {
          acc[product.category] = [];
        }
        acc[product.category].push(product);
      }
      return acc;
    }, {} as { [key: string]: Product[] });

    return (
      <div className="space-y-8">
        {Object.entries(groupedProducts).map(([category, categoryProducts]) => (
          <div key={category} className="space-y-4">
            <h2 className="text-xl font-bold text-[#640D5F] border-b-2 border-[#FFB200] pb-2">
              {category}
            </h2>
            
            <div className="space-y-3">
              {categoryProducts.map(product => {
                const orderItem = orderDetails?.items.find(item => item.product_id === product.id);
                if (!orderItem) return null;

                const isFullyFulfilled = orderItem.quantity === orderItem.fulfilled_quantity;

                return (
                  <div 
                    key={product.id} 
                    className={`flex items-center justify-between p-4 rounded-lg border-2 border-[#FFB200] ${
                      isFullyFulfilled ? 'bg-green-50' : 'bg-gray-50'
                    }`}
                  >
                    <span className="text-lg text-[#640D5F] font-medium">{product.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-[#640D5F]">הוזמן: {orderItem.quantity}</span>
                      <span className="text-[#640D5F]">סופק: {orderItem.fulfilled_quantity || 0}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (!orderDetails) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#640D5F] to-[#D91656] p-4">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-xl p-6">
        <div className="relative flex items-center justify-between mb-6">
          <button
            onClick={() => router.push('/orders')}
            className="absolute right-0 p-2 rounded-lg text-[#640D5F] hover:text-[#FFB200] transition-colors duration-200"
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              fill="none" 
              viewBox="0 0 24 24" 
              strokeWidth={1.5} 
              stroke="currentColor" 
              className="w-6 h-6"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
            </svg>
          </button>
          <h1 className="text-2xl font-bold text-[#640D5F] text-center w-full">
            הזמנה #{orderDetails?.id} - {orderDetails?.store?.name}
          </h1>
        </div>
        
        {renderContent()}
      </div>
    </div>
  );
} 