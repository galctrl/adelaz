'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

interface StoreResponse {
  name: string;
}

interface OrderResponse {
  id: number;
  store_id: number;
  status: string;
  updated_at: string;
  store: StoreResponse;
}

interface AccumulatedItem {
  product_id: number;
  product_name: string;
  total_quantity: number;
  order_count: number;
}

type OrderTab = 'open' | 'closed' | 'in_progress' | 'accumulated';

export default function MahsanPage() {
  const [activeOrderTab, setActiveOrderTab] = useState<OrderTab>('open');
  const [openOrders, setOpenOrders] = useState<OrderResponse[]>([]);
  const [closedOrders, setClosedOrders] = useState<OrderResponse[]>([]);
  const [inProgressOrders, setInProgressOrders] = useState<OrderResponse[]>([]);
  const [accumulatedItems, setAccumulatedItems] = useState<AccumulatedItem[]>([]);
  const router = useRouter();

  useEffect(() => {
    const storeId = localStorage.getItem('storeId');
    if (storeId !== "7") {
      router.push('/');
      return;
    }
    
    fetchOrders();
  }, []);

  useEffect(() => {
    if (activeOrderTab === 'accumulated') {
      fetchAccumulatedItems();
    }
  }, [activeOrderTab]);

  const fetchAccumulatedItems = async () => {
    // Get all open orders
    const { data: openOrdersData } = await supabase
      .from('orders')
      .select('id')
      .eq('status', 'open');

    if (!openOrdersData || openOrdersData.length === 0) {
      setAccumulatedItems([]);
      return;
    }

    const orderIds = openOrdersData.map(order => order.id);

    // Get all items from open orders
    const { data: itemsData } = await supabase
      .from('order_items')
      .select(`
        product_id,
        quantity,
        products!inner(name)
      `)
      .in('order_id', orderIds);

    if (itemsData) {
      // Accumulate quantities by product
      const accumulated = itemsData.reduce((acc, item) => {
        const productId = item.product_id;
        const productName = (item.products as any).name;
        
        if (!acc[productId]) {
          acc[productId] = {
            product_id: productId,
            product_name: productName,
            total_quantity: 0,
            order_count: 0
          };
        }
        
        acc[productId].total_quantity += item.quantity;
        acc[productId].order_count += 1;
        
        return acc;
      }, {} as { [key: number]: AccumulatedItem });

      // Convert to array and sort by total quantity
      const accumulatedArray = Object.values(accumulated).sort((a, b) => b.total_quantity - a.total_quantity);
      setAccumulatedItems(accumulatedArray);
    }
  };

  const fetchOrders = async () => {
    // Fetch open orders
    const { data: openData, error: openError } = await supabase
      .from('orders')
      .select(`
        id,
        store_id,
        status,
        updated_at,
        store:stores!inner(name)
      `)
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
    const { data: progressData, error: progressError } = await supabase
      .from('orders')
      .select(`
        id,
        store_id,
        status,
        updated_at,
        store:stores!inner(name)
      `)
      .eq('status', 'in_progress')
      .order('updated_at', { ascending: false });

    if (progressData) {
      const transformedProgressOrders = progressData.map(order => ({
        ...order,
        store: { name: (order.store as any).name }
      }));
      setInProgressOrders(transformedProgressOrders);
    }

    // Get date from 2 days ago
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const twoDaysAgoStr = twoDaysAgo.toISOString();

    // Update closed orders fetch
    const { data: closedData, error: closedError } = await supabase
      .from('orders')
      .select(`
        id,
        store_id,
        status,
        updated_at,
        store:stores!inner(name)
      `)
      .eq('status', 'closed')
      .gte('created_at', twoDaysAgoStr)  // Add date filter
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

  const renderAccumulatedItemsList = () => {
    if (accumulatedItems.length === 0) {
      return <p className="text-center text-gray-500">אין פריטים מצטברים</p>;
    }

    return (
      <div className="space-y-4">
        {accumulatedItems.map(item => (
          <div
            key={item.product_id}
            className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border-2 border-[#FFB200]"
          >
            <div className="flex flex-col">
              <span className="text-lg text-[#640D5F] font-medium">{item.product_name}</span>
              <span className="text-sm text-gray-500">כמות מצטברת: {item.total_quantity}</span>
              <span className="text-sm text-gray-500">מספר הזמנות: {item.order_count}</span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderOrdersList = (orders: OrderResponse[], status: OrderTab) => {
    if (orders.length === 0) {
      const statusText = {
        open: 'פתוחות',
        in_progress: 'בהכנה',
        closed: 'סגורות',
        accumulated: 'מצטברות'
      }[status];
      return <p className="text-center text-gray-500">אין הזמנות {statusText}</p>;
    }

    const handleOrderClick = async (orderId: number) => {
      if (status === 'open') {
        try {
          const { error: updateError } = await supabase
            .from('orders')
            .update({ 
              status: 'in_progress',
              updated_at: new Date().toISOString()
            })
            .eq('id', orderId)
            .select();

          if (updateError) {
            console.error('Error updating order status:', updateError);
            alert('שגיאה בעדכון סטטוס ההזמנה');
            return;
          }

          await fetchOrders();
        } catch (error) {
          console.error('Error updating order status:', error);
          alert('שגיאה בעדכון סטטוס ההזמנה');
          return;
        }
      }

      router.push(`/mahsan/order/${orderId}`);
    };

    return orders.map(order => (
      <div
        key={order.id}
        onClick={() => handleOrderClick(order.id)}
        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border-2 border-[#FFB200] cursor-pointer hover:bg-gray-100"
      >
        <div className="flex flex-col">
          <span className="text-lg text-[#640D5F] font-medium">
            הזמנה #{order.id} - {order.store?.name}
          </span>
          <span className="text-sm text-gray-500">
            עודכן: {formatDateTime(order.updated_at)}
          </span>
        </div>
        <span className="text-[#EB5B00]">⟵ לצפייה</span>
      </div>
    ));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#640D5F] to-[#D91656] p-4">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-xl p-6">
        <h1 className="text-2xl font-bold mb-6 text-[#640D5F] text-center">ניהול הזמנות</h1>
        
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
            className={`px-4 py-2 rounded-t-lg font-medium transition-colors duration-200 whitespace-nowrap ${
              activeOrderTab === 'in_progress'
                ? 'bg-[#FFB200] text-white'
                : 'text-[#640D5F] hover:bg-[#FFB200]/20'
            }`}
          >
            הזמנות בהכנה
          </button>
          <button
            onClick={() => setActiveOrderTab('closed')}
            className={`px-4 py-2 rounded-t-lg font-medium transition-colors duration-200 whitespace-nowrap ${
              activeOrderTab === 'closed'
                ? 'bg-[#FFB200] text-white'
                : 'text-[#640D5F] hover:bg-[#FFB200]/20'
            }`}
          >
            הזמנות סגורות
          </button>
          <button
            onClick={() => setActiveOrderTab('accumulated')}
            className={`px-4 py-2 rounded-t-lg font-medium transition-colors duration-200 whitespace-nowrap ${
              activeOrderTab === 'accumulated'
                ? 'bg-[#FFB200] text-white'
                : 'text-[#640D5F] hover:bg-[#FFB200]/20'
            }`}
          >
            הזמנות מצטבר
          </button>
        </div>

        <div className="space-y-4">
          {activeOrderTab === 'open' 
            ? renderOrdersList(openOrders, activeOrderTab)
            : activeOrderTab === 'in_progress'
              ? renderOrdersList(inProgressOrders, activeOrderTab)
              : activeOrderTab === 'closed'
                ? renderOrdersList(closedOrders, activeOrderTab)
                : activeOrderTab === 'accumulated'
                  ? renderAccumulatedItemsList()
                  : null}
        </div>
      </div>
    </div>
  );
} 