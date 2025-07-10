'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

interface StoreResponse {
  name: string;
}

interface Order {
  id: number;
  store_id: number;
  status: string;
  updated_at: string;
  store: StoreResponse;
}

type OrderTab = 'open' | 'in_progress' | 'closed';

export default function OrdersPage() {
  const [activeOrderTab, setActiveOrderTab] = useState<OrderTab>('open');
  const [openOrders, setOpenOrders] = useState<Order[]>([]);
  const [inProgressOrders, setInProgressOrders] = useState<Order[]>([]);
  const [closedOrders, setClosedOrders] = useState<Order[]>([]);
  const router = useRouter();

  useEffect(() => {
    const storeId = localStorage.getItem('storeId');
    if (!storeId) {
      router.push('/');
      return;
    }
    
    fetchOrders(parseInt(storeId));
  }, []);

  const fetchOrders = async (storeId: number) => {
    // Fetch open orders
    const { data: openData } = await supabase
      .from('orders')
      .select(`
        id,
        store_id,
        status,
        updated_at,
        store:stores!inner(name)
      `)
      .eq('store_id', storeId)
      .eq('status', 'open')
      .order('updated_at', { ascending: false });

    if (openData) {
      const transformedOpenOrders = openData.map(order => ({
        ...order,
        store: { name: (order.store as any).name }
      }));
      setOpenOrders(transformedOpenOrders);
    }

    // Fetch in_progress orders
    const { data: progressData } = await supabase
      .from('orders')
      .select(`
        id,
        store_id,
        status,
        updated_at,
        store:stores!inner(name)
      `)
      .eq('store_id', storeId)
      .eq('status', 'in_progress')
      .order('updated_at', { ascending: false });

    if (progressData) {
      const transformedProgressOrders = progressData.map(order => ({
        ...order,
        store: { name: (order.store as any).name }
      }));
      setInProgressOrders(transformedProgressOrders);
    }

    // Fetch closed orders
    const { data: closedData } = await supabase
      .from('orders')
      .select(`
        id,
        store_id,
        status,
        updated_at,
        store:stores!inner(name)
      `)
      .eq('store_id', storeId)
      .eq('status', 'closed')
      .order('updated_at', { ascending: false });

    if (closedData) {
      const transformedClosedOrders = closedData.map(order => ({
        ...order,
        store: { name: (order.store as any).name }
      }));
      setClosedOrders(transformedClosedOrders);
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('he-IL', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric'
    });
  };

  const renderOrdersList = (orders: Order[]) => {
    if (orders.length === 0) {
      const statusText = {
        open: 'פתוחות',
        in_progress: 'בהכנה',
        closed: 'סגורות'
      }[activeOrderTab];
      return <p className="text-center text-gray-500">אין הזמנות {statusText}</p>;
    }

    return orders.map(order => (
      <div
        key={order.id}
        onClick={() => router.push(`/order/${order.id}`)}
        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border-2 border-[#FFB200] cursor-pointer hover:bg-gray-100"
      >
        <div className="flex flex-col">
          <span className="text-lg text-[#640D5F] font-medium">
            הזמנה #{order.id}
          </span>
          <span className="text-sm text-gray-500">
            עודכן: {formatDateTime(order.updated_at)}
          </span>
        </div>
        <span className="text-[#EB5B00]">לצפייה ⟵</span>
      </div>
    ));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#640D5F] to-[#D91656] p-4">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-xl p-6">
        <div className="relative flex items-center justify-between mb-6">
          <button
            onClick={() => router.push('/order')}
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
          <h1 className="text-2xl font-bold text-[#640D5F] text-center w-full">ניהול הזמנות</h1>
        </div>
        
        <div className="flex space-x-2 mb-6 border-b border-[#FFB200] overflow-x-auto touch-pan-x" style={{ WebkitOverflowScrolling: 'touch' }}>
          <button
            onClick={() => setActiveOrderTab('open')}
            className={`flex-shrink-0 px-4 py-2 rounded-t-lg font-medium transition-colors duration-200 whitespace-nowrap ${
              activeOrderTab === 'open'
                ? 'bg-[#FFB200] text-white'
                : 'text-[#640D5F] hover:bg-[#FFB200]/20'
            }`}
          >
            הזמנות פתוחות
          </button>
          <button
            onClick={() => setActiveOrderTab('in_progress')}
            className={`flex-shrink-0 px-4 py-2 rounded-t-lg font-medium transition-colors duration-200 whitespace-nowrap ${
              activeOrderTab === 'in_progress'
                ? 'bg-[#FFB200] text-white'
                : 'text-[#640D5F] hover:bg-[#FFB200]/20'
            }`}
          >
            הזמנות בהכנה
          </button>
          <button
            onClick={() => setActiveOrderTab('closed')}
            className={`flex-shrink-0 px-4 py-2 rounded-t-lg font-medium transition-colors duration-200 whitespace-nowrap ${
              activeOrderTab === 'closed'
                ? 'bg-[#FFB200] text-white'
                : 'text-[#640D5F] hover:bg-[#FFB200]/20'
            }`}
          >
            הזמנות סגורות
          </button>
        </div>

        <div className="space-y-4">
          {renderOrdersList(
            activeOrderTab === 'open' 
              ? openOrders 
              : activeOrderTab === 'in_progress'
                ? inProgressOrders
                : closedOrders
          )}
        </div>
      </div>
    </div>
  );
} 