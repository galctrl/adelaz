'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Product } from '@/types';
import { useRouter } from 'next/navigation';

interface OpenOrder {
  id: number;
  items: {
    product_id: number;
    quantity: number;
  }[];
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

const OrdersIcon = () => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    fill="none" 
    viewBox="0 0 24 24" 
    strokeWidth={1.5} 
    stroke="currentColor" 
    className="w-6 h-6"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z" />
  </svg>
);

export default function OrderPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [quantities, setQuantities] = useState<{[key: string]: string}>({});
  const [selectedCategory, setSelectedCategory] = useState<string>('ירקות');
  const [categories, setCategories] = useState<string[]>([]);
  const [debounceTimers, setDebounceTimers] = useState<{[key: string]: NodeJS.Timeout}>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const storeId = localStorage.getItem('storeId');
    if (!storeId) {
      router.push('/');
      return;
    }
    
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('available', true)
      .order('name');

    if (data) {
      setProducts(data);
      const uniqueCategories = [...new Set(data.map(product => product.category))].filter(Boolean) as string[];
      setCategories(uniqueCategories);
    }
  };

  const filteredProducts = products.filter(product => product.category === selectedCategory);
  const selectedProducts = products.filter(product => {
    const quantity = quantities[product.id.toString()];
    return quantity && parseInt(quantity) > 0;
  });

  const debouncedQuantityChange = useCallback((productId: number | string, quantity: string) => {
    const productIdStr = productId.toString();
    
    // Clear existing timer for this product
    if (debounceTimers[productIdStr]) {
      clearTimeout(debounceTimers[productIdStr]);
    }
    
    // Set new timer
    const timer = setTimeout(() => {
      handleQuantityChange(productId, quantity);
    }, 500); // 500ms delay
    
    setDebounceTimers(prev => ({
      ...prev,
      [productIdStr]: timer
    }));
  }, [debounceTimers]);

  const handleQuantityChange = (productId: number | string, quantity: string) => {
    const productIdStr = productId.toString();
    setQuantities(prev => ({
      ...prev,
      [productIdStr]: quantity
    }));
  };

  const handleIncrement = (productId: number | string) => {
    const productIdStr = productId.toString();
    const currentValue = quantities[productIdStr] || '';
    const currentNumber = currentValue === '' ? 0 : parseInt(currentValue) || 0;
    const newValue = (currentNumber + 1).toString();
    handleQuantityChange(productId, newValue);
  };

  const handleDecrement = (productId: number | string) => {
    const productIdStr = productId.toString();
    const currentValue = quantities[productIdStr] || '';
    const currentNumber = currentValue === '' ? 0 : parseInt(currentValue) || 0;
    const newValue = Math.max(0, currentNumber - 1).toString();
    handleQuantityChange(productId, newValue);
  };

  const handleInputChange = (productId: number | string, value: string) => {
    const productIdStr = productId.toString();
    
    // Update local state immediately for responsive UI
    setQuantities(prev => ({
      ...prev,
      [productIdStr]: value
    }));
    
    // Debounce the actual API call
    if (value === '' || /^\d*$/.test(value)) {
      debouncedQuantityChange(productId, value);
    }
  };

  const handleFinishOrder = async () => {
    const storeId = localStorage.getItem('storeId');
    if (!storeId) {
      router.push('/');
      return;
    }

    // Check if there are any items in the cart
    const hasItems = selectedProducts.length > 0;
    if (!hasItems) {
      alert('אין מוצרים בהזמנה');
      return;
    }

    setIsSubmitting(true);

    try {
      // Create new order
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          store_id: parseInt(storeId),
          status: 'open'
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Insert all order items
      const orderItems = selectedProducts.map(product => ({
        order_id: orderData.id,
        product_id: product.id.toString(),
        quantity: parseInt(quantities[product.id.toString()]),
        fulfilled_quantity: 0
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      alert('ההזמנה נשלחה בהצלחה');
      
      // Clear the cart
      setQuantities({});
      
      // Navigate to orders page
      router.push('/orders');
    } catch (error) {
      console.error('Error creating order:', error);
      alert('שגיאה בשליחת ההזמנה');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderContent = () => {
    if (selectedCategory === 'הזמנה') {
      return (
        <div className="space-y-4">
          {selectedProducts.length === 0 ? (
            <p className="text-center text-gray-500">לא נבחרו מוצרים</p>
          ) : (
            <>
              {selectedProducts.map(product => (
                <div key={product.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border-2 border-[#FFB200]">
                  <div className="flex flex-col">
                    <span className="text-lg text-[#640D5F] font-medium">{product.name}</span>
                    <span className="text-sm text-gray-500">{product.category}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[#640D5F]">כמות: {quantities[product.id.toString()]}</span>
                  </div>
                </div>
              ))}
              
              <button
                onClick={handleFinishOrder}
                disabled={isSubmitting}
                className="w-full py-3 px-4 rounded-lg font-bold text-white bg-[#EB5B00] hover:bg-[#FFB200] transition-colors duration-200 disabled:opacity-50"
              >
                {isSubmitting ? 'שולח הזמנה...' : 'סיים הזמנה'}
              </button>
            </>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {filteredProducts.map(product => (
          <div key={product.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border-2 border-[#FFB200]">
            <span className="text-lg text-[#640D5F] font-medium">{product.name}</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleDecrement(product.id)}
                className="p-2 rounded-lg text-[#640D5F] hover:text-[#FFB200] transition-colors duration-200 border-2 border-[#FFB200] hover:border-[#EB5B00]"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-4 h-4"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
                </svg>
              </button>
              <input
                type="text"
                value={quantities[product.id.toString()] || ''}
                onChange={(e) => handleInputChange(product.id, e.target.value)}
                className="w-16 text-center rounded-lg border-2 border-[#FFB200] p-2 text-[#640D5F] focus:border-[#EB5B00] focus:ring-[#EB5B00] bg-white"
                placeholder="0"
              />
              <button
                onClick={() => handleIncrement(product.id)}
                className="p-2 rounded-lg text-[#640D5F] hover:text-[#FFB200] transition-colors duration-200 border-2 border-[#FFB200] hover:border-[#EB5B00]"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-4 h-4"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#640D5F] to-[#D91656] p-4">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-xl p-6">
        <div className="relative flex items-center justify-between mb-6">
          <div className="absolute left-0 flex items-center gap-4">
            <button
              onClick={() => setSelectedCategory('הזמנה')}
              className={`p-2 rounded-lg transition-colors duration-200 ${
                selectedCategory === 'הזמנה'
                  ? 'text-[#FFB200]'
                  : 'text-[#640D5F] hover:text-[#FFB200]'
              }`}
            >
              <CartIcon itemCount={selectedProducts.length} />
            </button>
            <button
              onClick={() => router.push('/orders')}
              className="p-2 rounded-lg transition-colors duration-200 text-[#640D5F] hover:text-[#FFB200]"
            >
              <OrdersIcon />
            </button>
          </div>
          <h1 className="text-2xl font-bold text-[#640D5F] text-center w-full">
            הזמנה חדשה
          </h1>
        </div>
        
        <div className="flex space-x-2 mb-6 border-b border-[#FFB200] overflow-x-auto touch-pan-x" style={{ WebkitOverflowScrolling: 'touch' }}>
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`flex-shrink-0 px-4 py-2 rounded-t-lg font-medium transition-colors duration-200 ${
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