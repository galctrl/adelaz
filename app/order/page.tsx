'use client';

import { useEffect, useState } from 'react';
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

export default function OrderPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [quantities, setQuantities] = useState<{[key: string]: number}>({});
  const [selectedCategory, setSelectedCategory] = useState<string>('ירקות');
  const [categories, setCategories] = useState<string[]>([]);
  const [currentOrderId, setCurrentOrderId] = useState<number | null>(null);
  const router = useRouter();

  useEffect(() => {
    const storeId = localStorage.getItem('storeId');
    if (!storeId) {
      router.push('/');
      return;
    }
    
    fetchProducts();
    checkExistingOrder(parseInt(storeId));
  }, []);

  const checkExistingOrder = async (storeId: number) => {
    // Get the latest open order for this store
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select('id')
      .eq('store_id', storeId)
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (orderData) {
      // Found an open order, get its items
      const { data: itemsData } = await supabase
        .from('order_items')
        .select('product_id, quantity')
        .eq('order_id', orderData.id);

      if (itemsData) {
        // Convert items to quantities object
        const savedQuantities = itemsData.reduce((acc, item) => ({
          ...acc,
          [item.product_id]: item.quantity
        }), {});

        setQuantities(savedQuantities);
        setCurrentOrderId(orderData.id);
      }
    }
  };

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
  const selectedProducts = products.filter(product => quantities[product.id.toString()] > 0);

  const handleQuantityChange = async (productId: number | string, quantity: number) => {
    const productIdStr = productId.toString();
    const storeId = localStorage.getItem('storeId');
    if (!storeId) return;

    try {
      if (currentOrderId) {
        // Check current order status
        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .select('status')
          .eq('id', currentOrderId)
          .single();

        if (orderError) throw orderError;

        if (orderData.status !== 'open') {
          // Create new order if current order is not open
          const { data: newOrderData, error: newOrderError } = await supabase
            .from('orders')
            .insert({
              store_id: parseInt(storeId),
              status: 'open'
            })
            .select()
            .single();

          if (newOrderError) throw newOrderError;

          // Set the new order as current
          setCurrentOrderId(newOrderData.id);

          // Insert the new quantity
          const { error: insertError } = await supabase
            .from('order_items')
            .insert({
              order_id: newOrderData.id,
              product_id: productIdStr,
              quantity: quantity,
              fulfilled_quantity: 0
            });

          if (insertError) throw insertError;

          // Update quantities state
          setQuantities({ [productIdStr]: quantity });

          // Alert user about new order creation
          alert('נוצרה הזמנה חדשה');
          return;
        }
      }

      // Continue with normal flow for open orders or no current order
      setQuantities(prev => ({
        ...prev,
        [productIdStr]: quantity
      }));

      if (!currentOrderId) {
        // Create new order if none exists
        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .insert({
            store_id: parseInt(storeId),
            status: 'open'
          })
          .select()
          .single();

        if (orderError) throw orderError;
        setCurrentOrderId(orderData.id);

        // Insert first item
        const { error: itemError } = await supabase
          .from('order_items')
          .insert({
            order_id: orderData.id,
            product_id: productIdStr,
            quantity: quantity,
            fulfilled_quantity: 0
          });

        if (itemError) throw itemError;

      } else {
        // Update existing order
        if (quantity === 0) {
          // Delete item if quantity is 0
          const { error: deleteError } = await supabase
            .from('order_items')
            .delete()
            .eq('order_id', currentOrderId)
            .eq('product_id', productIdStr);

          if (deleteError) throw deleteError;
        } else {
          // Check if item exists
          const { data: existingItems, error: checkError } = await supabase
            .from('order_items')
            .select()
            .eq('order_id', currentOrderId)
            .eq('product_id', productIdStr);

          if (checkError) throw checkError;

          if (existingItems && existingItems.length > 0) {
            // Update existing item
            const { error: updateError } = await supabase
              .from('order_items')
              .update({ quantity: quantity })
              .eq('order_id', currentOrderId)
              .eq('product_id', productIdStr);

            if (updateError) throw updateError;
          } else {
            // Insert new item
            const { error: insertError } = await supabase
              .from('order_items')
              .insert({
                order_id: currentOrderId,
                product_id: productIdStr,
                quantity: quantity,
                fulfilled_quantity: 0
              });

            if (insertError) throw insertError;
          }
        }
      }
    } catch (error) {
      console.error('Error updating order:', error);
      setQuantities(prev => ({
        ...prev,
        [productIdStr]: prev[productIdStr] || 0
      }));
      alert('שגיאה בעדכון ההזמנה');
    }
  };

  const renderContent = () => {
    if (selectedCategory === 'הזמנה') {
      return (
        <div className="space-y-4">
          {selectedProducts.length === 0 ? (
            <p className="text-center text-gray-500">לא נבחרו מוצרים</p>
          ) : (
            selectedProducts.map(product => (
              <div key={product.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border-2 border-[#FFB200]">
                <div className="flex flex-col">
                  <span className="text-lg text-[#640D5F] font-medium">{product.name}</span>
                  <span className="text-sm text-gray-500">{product.category}</span>
                </div>
                <span className="text-lg text-[#640D5F] font-bold">
                  כמות: {quantities[product.id.toString()]}
                </span>
              </div>
            ))
          )}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {filteredProducts.map(product => (
          <div key={product.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border-2 border-[#FFB200]">
            <span className="text-lg text-[#640D5F] font-medium">{product.name}</span>
            <select
              value={quantities[product.id.toString()] || 0}
              onChange={(e) => handleQuantityChange(product.id, parseInt(e.target.value))}
              className="ml-4 rounded-lg border-2 border-[#FFB200] p-2 text-[#640D5F] focus:border-[#EB5B00] focus:ring-[#EB5B00] bg-white"
            >
              {[...Array(11)].map((_, i) => (
                <option key={i} value={i}>{i}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
    );
  };

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
            <CartIcon itemCount={selectedProducts.length} />
          </button>
          <h1 className="text-2xl font-bold text-[#640D5F] text-center w-full">
            {currentOrderId ? 'עריכת הזמנה' : 'הזמנה חדשה'}
          </h1>
        </div>
        
        <div className="flex space-x-2 mb-6 border-b border-[#FFB200]">
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