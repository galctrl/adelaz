'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Product } from '@/types';

// Update the interfaces at the top of the file
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

export default function MahsanOrderPage() {
  // Copy all state and functions from admin/order/[id]/page.tsx
  // The functionality remains the same, just the route and access check changes
  const [products, setProducts] = useState<Product[]>([]);
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('ירקות');
  const [categories, setCategories] = useState<string[]>([]);
  const [fulfilledQuantities, setFulfilledQuantities] = useState<{[key: string]: number}>({});
  const [showThaiNames, setShowThaiNames] = useState(false);
  const [showOnlyIncomplete, setShowOnlyIncomplete] = useState(false);
  const router = useRouter();
  const params = useParams();
  const orderId = params?.id as string;

  useEffect(() => {
    const storeId = localStorage.getItem('storeId');
    if (storeId !== "7") {  // Changed from isAdmin check to storeId check
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
        // Add type assertion to handle the store data structure
        const storeData = orderData.store as unknown as { name: string };
        
        const transformedOrderData: OrderDetails = {
          ...orderData,
          store: { name: storeData.name },
          items: itemsData
        };
        
        setOrderDetails(transformedOrderData);
        
        const initialFulfilled = itemsData.reduce((acc, item) => ({
          ...acc,
          [item.product_id.toString()]: item.fulfilled_quantity || item.quantity
        }), {} as {[key: string]: number});
        
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
      [productId.toString()]: quantity
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
          .eq('product_id', parseInt(productId))
      );

      await Promise.all(updatePromises);

      // Close the order
      await supabase
        .from('orders')
        .update({ status: 'closed' })
        .eq('id', orderDetails.id);

      alert('ההזמנה נסגרה בהצלחה');
      router.push('/mahsan');  // Changed from /admin to /mahsan
    } catch (error) {
      console.error('Error closing order:', error);
      alert('שגיאה בסגירת ההזמנה');
    }
  };

  const getProductsForCategory = (category: string) => {
    let filteredProducts = products.filter(product => 
      orderDetails?.items.some(item => item.product_id === product.id)
    );

    // If showing only incomplete items, filter out fully fulfilled ones
    if (showOnlyIncomplete && orderDetails) {
      filteredProducts = filteredProducts.filter(product => {
        const orderItem = orderDetails.items.find(item => item.product_id === product.id);
        if (!orderItem) return false;
        
        const productId = product.id.toString();
        let fulfilledQty = 0;
        
        // For open orders, use the current state
        if (orderDetails.status === 'open') {
          fulfilledQty = fulfilledQuantities[productId] || 0;
        } else {
          // For closed orders, use the database value
          fulfilledQty = orderItem.fulfilled_quantity || 0;
        }
        
        return fulfilledQty < orderItem.quantity;
      });
    }

    if (category === 'הזמנה') {
      return filteredProducts;
    }
    
    return filteredProducts.filter(product => product.category === category);
  };

  const getIncompleteItemsCount = () => {
    if (!orderDetails) return 0;
    
    return orderDetails.items.filter(item => {
      const productId = item.product_id.toString();
      let fulfilledQty = 0;
      
      // For open orders, use the current state
      if (orderDetails.status === 'open') {
        fulfilledQty = fulfilledQuantities[productId] || 0;
      } else {
        // For closed orders, use the database value
        fulfilledQty = item.fulfilled_quantity || 0;
      }
      
      return fulfilledQty < item.quantity;
    }).length;
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

    // Apply filter if needed
    if (showOnlyIncomplete && orderDetails) {
      Object.keys(groupedProducts).forEach(category => {
        groupedProducts[category] = groupedProducts[category].filter(product => {
          const orderItem = orderDetails.items.find(item => item.product_id === product.id);
          if (!orderItem) return false;
          
          const productId = product.id.toString();
          let fulfilledQty = 0;
          
          if (orderDetails.status === 'open') {
            fulfilledQty = fulfilledQuantities[productId] || 0;
          } else {
            fulfilledQty = orderItem.fulfilled_quantity || 0;
          }
          
          return fulfilledQty < orderItem.quantity;
        });
      });
    }

    // Remove empty categories
    Object.keys(groupedProducts).forEach(category => {
      if (groupedProducts[category].length === 0) {
        delete groupedProducts[category];
      }
    });

    if (Object.keys(groupedProducts).length === 0) {
      return (
        <div className="text-center text-gray-500">
          {showOnlyIncomplete ? 'אין מוצרים שטרם סופקו במלואם' : 'אין מוצרים'}
        </div>
      );
    }

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

                const productId = product.id.toString();
                let fulfilledQty = 0;
                
                // For open orders, use the current state
                if (orderDetails?.status === 'open') {
                  fulfilledQty = fulfilledQuantities[productId] || 0;
                } else {
                  // For closed orders, use the database value
                  fulfilledQty = orderItem.fulfilled_quantity || 0;
                }
                
                const isFullyFulfilled = orderItem.quantity === fulfilledQty;

                return (
                  <div 
                    key={productId} 
                    className={`flex items-center justify-between p-4 rounded-lg border-2 border-[#FFB200] ${
                      isFullyFulfilled ? 'bg-green-50' : 'bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg text-[#640D5F] font-medium">
                        {showThaiNames ? product.thai_product_name : product.name}
                      </span>
                      <button
                        onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(product.name)}&tbm=isch`, '_blank')}
                        className="p-1 rounded-lg text-[#640D5F] hover:text-[#FFB200] transition-colors duration-200"
                        title="חפש תמונות בגוגל"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                          className="w-5 h-5"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                          />
                        </svg>
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[#640D5F]">הוזמן: {orderItem.quantity}</span>
                      {(orderDetails?.status === 'open' || orderDetails?.status === 'in_progress') ? (
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
                        <span className="text-[#640D5F]">סופק: {fulfilledQty}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {(orderDetails?.status === 'open' || orderDetails?.status === 'in_progress') && (
          <button
            onClick={handleCloseOrder}
            className="mt-6 w-full py-3 px-4 rounded-lg font-bold text-white bg-[#EB5B00] hover:bg-[#FFB200] transition-colors duration-200"
          >
            סגור הזמנה
          </button>
        )}
      </div>
    );
  };

  if (!orderDetails) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#640D5F] to-[#D91656] p-4">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-xl p-6">
        <div className="relative flex items-center justify-between mb-6">
          <button
            onClick={() => router.push('/mahsan')}
            className="p-2 rounded-lg text-[#640D5F] hover:text-[#FFB200] transition-colors duration-200"
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
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowOnlyIncomplete(!showOnlyIncomplete)}
              className={`p-2 rounded-lg transition-colors duration-200 ${
                showOnlyIncomplete
                  ? 'text-[#FFB200]'
                  : 'text-[#640D5F] hover:text-[#FFB200]'
              }`}
              title="הצג רק מוצרים שטרם סופקו במלואם"
            >
              <div className="relative">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-6 h-6"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z"
                  />
                </svg>
                {getIncompleteItemsCount() > 0 && (
                  <span className="absolute -top-2 -right-2 bg-[#EB5B00] text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                    {getIncompleteItemsCount()}
                  </span>
                )}
              </div>
            </button>
            <button
              onClick={() => setShowThaiNames(!showThaiNames)}
              className="p-2 rounded-lg text-[#640D5F] hover:text-[#FFB200] transition-colors duration-200"
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                fill="none" 
                viewBox="0 0 24 24" 
                strokeWidth={1.5} 
                stroke="currentColor" 
                className="w-6 h-6"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 7.5a2.25 2.25 0 100-4.5 2.25 2.25 0 000 4.5z" />
              </svg>
            </button>
          </div>
        </div>
        
        {renderContent()}
      </div>
    </div>
  );
} 