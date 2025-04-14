'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Product } from '@/types';

interface StoreResponse {
  name: string;
}

interface OrderResponse {
  id: number;
  store_id: number;
  status: string;
  store: StoreResponse;
}

interface OrderItem {
  product_id: number;
  quantity: number;
  fulfilled_quantity?: number;
}

interface OrderDetails {
  id: number;
  store_id: number;
  status: string;
  store: StoreResponse;
  items: OrderItem[];
}

const CartIcon = ({ itemCount }: { itemCount: number }) => (
  <div className="relative">
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      fill="none" 
      viewBox="0 0 24 24" 
      strokeWidth={1.5} 
      stroke="currentColor" 
      className="w-6 h-6"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
    </svg>
    {itemCount > 0 && (
      <span className="absolute -top-2 -right-2 bg-[#EB5B00] text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
        {itemCount}
      </span>
    )}
  </div>
);

export default function AdminOrderPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('ירקות');
  const [categories, setCategories] = useState<string[]>([]);
  const [fulfilledQuantities, setFulfilledQuantities] = useState<{[key: string | number]: number}>({});
  const router = useRouter();
  const params = useParams();
  const orderId = params?.id as string;

  useEffect(() => {
    const isAdmin = localStorage.getItem('isAdmin');
    if (isAdmin !== 'true') {
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
        store:stores!inner(
          name
        )
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
        
        const initialFulfilled = itemsData.reduce((acc, item) => ({
          ...acc,
          [item.product_id]: item.fulfilled_quantity || item.quantity
        }), {});
        
        setFulfilledQuantities(initialFulfilled);
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
      const uniqueCategories = [...new Set(data.map(product => product.category))].filter(Boolean) as string[];
      setCategories(uniqueCategories);
    }
  };

  const handleFulfilledChange = (productId: string | number, quantity: number) => {
    setFulfilledQuantities(prev => ({
      ...prev,
      [productId]: quantity
    }));
  };

  const handleCloseOrder = async () => {
    if (!orderDetails) return;

    try {
      // Update fulfilled quantities
      const updatePromises = Object.entries(fulfilledQuantities).map(([productId, quantity]) => 
        supabase
          .from('order_items')
          .update({ fulfilled_quantity: quantity })
          .eq('order_id', orderDetails.id)
          .eq('product_id', productId)
      );

      await Promise.all(updatePromises);

      // Close the order
      await supabase
        .from('orders')
        .update({ status: 'closed' })
        .eq('id', orderDetails.id);

      alert('ההזמנה נסגרה בהצלחה');
      router.push('/admin');
    } catch (error) {
      console.error('Error closing order:', error);
      alert('שגיאה בסגירת ההזמנה');
    }
  };

  const getProductsForCategory = (category: string) => {
    if (category === 'הזמנה') {
      return products.filter(product => 
        orderDetails?.items.some(item => item.product_id === product.id)
      );
    }
    return products.filter(product => 
      product.category === category && 
      orderDetails?.items.some(item => item.product_id === product.id)
    );
  };

  const renderContent = () => {
    const categoryProducts = getProductsForCategory(selectedCategory);

    if (selectedCategory === 'הזמנה') {
      return (
        <div className="space-y-4">
          {categoryProducts.map(product => {
            const orderItem = orderDetails?.items.find(item => item.product_id === product.id);
            if (!orderItem) return null;

            const productId = product.id.toString();
            const isFullyFulfilled = orderItem.quantity === fulfilledQuantities[productId];

            return (
              <div 
                key={productId} 
                className={`flex items-center justify-between p-4 rounded-lg border-2 border-[#FFB200] ${
                  isFullyFulfilled ? 'bg-green-50' : 'bg-gray-50'
                }`}
              >
                <div className="flex flex-col">
                  <span className="text-lg text-[#640D5F] font-medium">{product.name}</span>
                  <span className="text-sm text-gray-500">{product.category}</span>
                </div>
                <div className="flex items-center space-x-4 gap-2 text-[#640D5F]">
                  <span>הוזמן: {orderItem.quantity}</span>
                  <span>סופק: {fulfilledQuantities[productId] || 0}</span>
                </div>
              </div>
            );
          })}
          {orderDetails?.status === 'open' && (
            <button
              onClick={handleCloseOrder}
              className="mt-6 w-full py-3 px-4 rounded-lg font-bold text-white bg-[#EB5B00] hover:bg-[#FFB200] transition-colors duration-200"
            >
              סגור הזמנה
            </button>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {categoryProducts.map(product => {
          const orderItem = orderDetails?.items.find(item => item.product_id === product.id);
          if (!orderItem) return null;

          const productId = product.id.toString();
          const isFullyFulfilled = orderItem.quantity === fulfilledQuantities[productId];

          return (
            <div 
              key={productId} 
              className={`flex items-center justify-between p-4 rounded-lg border-2 border-[#FFB200] ${
                isFullyFulfilled ? 'bg-green-50' : 'bg-gray-50'
              }`}
            >
              <span className="text-lg text-[#640D5F] font-medium">{product.name}</span>
              <div className="flex items-center gap-3">
                <span className="text-[#640D5F]">הוזמן: {orderItem.quantity}</span>
                {orderDetails?.status === 'open' ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[#640D5F]">סופק: </span>
                    <select
                      value={fulfilledQuantities[productId] || 0}
                      onChange={(e) => handleFulfilledChange(productId, parseInt(e.target.value))}
                      className="rounded-lg border-2 border-[#FFB200] p-2 text-[#640D5F]"
                    >
                      {[...Array(orderItem.quantity + 1)].map((_, i) => (
                        <option key={i} value={i}>{i}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <span className="text-[#640D5F]">סופק: {orderItem.fulfilled_quantity || 0}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (!orderDetails) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#640D5F] to-[#D91656] p-4">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-xl p-6">
        <div className="relative flex items-center justify-between mb-6">
          <button
            onClick={() => setSelectedCategory('הזמנה')}
            className={`absolute left-0 p-2 rounded-lg transition-colors duration-200 ${
              selectedCategory === 'הזמנה'
                ? 'text-[#FFB200]'
                : 'text-[#640D5F] hover:text-[#FFB200]'
            }`}
          >
            <CartIcon itemCount={orderDetails?.items.length || 0} />
          </button>
          <h1 className="text-2xl font-bold text-[#640D5F] text-center w-full">
            הזמנה #{orderDetails?.id} - {orderDetails?.store?.name}
          </h1>
        </div>
        
        <div className="flex space-x-2 mb-6 border-b border-[#FFB200] overflow-x-auto">
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-t-lg font-medium transition-colors duration-200 ${
                selectedCategory === category
                  ? 'bg-[#FFB200] text-white'
                  : 'text-[#640D5F] hover:bg-[#FFB200]/20'
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {renderContent()}
      </div>
    </div>
  );
} 