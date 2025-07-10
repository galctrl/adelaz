'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Product } from '@/types';
import { useRouter } from 'next/navigation';

interface Order {
  id: number;
  store_id: number;
  status: string;
  updated_at: string;
  store: {
    name: string;
  };
}

interface AccumulatedItem {
  product_id: number;
  product_name: string;
  total_quantity: number;
  order_count: number;
}

type MainTab = 'products' | 'orders';
type OrderTab = 'open' | 'in_progress' | 'closed' | 'accumulated';

export default function AdminPage() {
  const [activeMainTab, setActiveMainTab] = useState<MainTab>('products');
  const [activeOrderTab, setActiveOrderTab] = useState<OrderTab>('open');
  const [products, setProducts] = useState<Product[]>([]);
  const [openOrders, setOpenOrders] = useState<Order[]>([]);
  const [inProgressOrders, setInProgressOrders] = useState<Order[]>([]);
  const [closedOrders, setClosedOrders] = useState<Order[]>([]);
  const [accumulatedItems, setAccumulatedItems] = useState<AccumulatedItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [editingProductId, setEditingProductId] = useState<string | number | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  const router = useRouter();

  useEffect(() => {
    const isAdmin = localStorage.getItem('isAdmin');
    if (isAdmin !== 'true') {
      router.push('/');
      return;
    }
    
    fetchProducts();
    fetchOrders();
  }, []);

  useEffect(() => {
    if (activeOrderTab === 'accumulated') {
      fetchAccumulatedItems();
    }
  }, [activeOrderTab]);

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name');

    if (data) {
      setProducts(data);
      const uniqueCategories = [...new Set(data.map(product => product.category))].filter(Boolean) as string[];
      setCategories(uniqueCategories);
      if (!selectedCategory && uniqueCategories.length > 0) {
        setSelectedCategory(uniqueCategories[0]);
      }
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

    // Add fetch for in_progress orders
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

    // Fetch closed orders
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
      .order('updated_at', { ascending: false });

    if (closedData) {
      const transformedClosedOrders = closedData.map(order => ({
        ...order,
        store: { name: (order.store as any).name }
      }));
      setClosedOrders(transformedClosedOrders);
    }
  };

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

  const handleAvailabilityToggle = async (product: Product) => {
    const { error } = await supabase
      .from('products')
      .update({ available: !product.available })
      .eq('id', product.id);

    if (!error) {
      fetchProducts();
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

  const handleProductNameUpdate = async (productId: string | number, newName: string) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({ name: newName })
        .eq('id', productId);

      if (error) {
        console.error('Error updating product name:', error);
        alert('שגיאה בעדכון שם המוצר');
        return;
      }

      // Update local state
      setProducts(products.map(product => 
        product.id === productId 
          ? { ...product, name: newName }
          : product
      ));
    } catch (error) {
      console.error('Error updating product name:', error);
      alert('שגיאה בעדכון שם המוצר');
    } finally {
      setEditingProductId(null);
      setEditingName('');
    }
  };

  const getProductsForCategory = (category: string) => {
    return products.filter(product => product.category === category);
  };

  const renderProductsContent = () => {
    const filteredProducts = selectedCategory 
      ? products.filter(product => product.category === selectedCategory)
      : products;

    return (
      <div>
        {/* Category Tabs */}
        <div className="flex space-x-2 mb-6 border-b border-[#FFB200] overflow-x-auto">
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-t-lg font-medium transition-colors duration-200 whitespace-nowrap ${
                selectedCategory === category
                  ? 'bg-[#FFB200] text-white'
                  : 'text-[#640D5F] hover:bg-[#FFB200]/20'
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Products List */}
        <div className="space-y-4">
          {filteredProducts.map(product => (
            <div 
              key={product.id}
              className="flex items-center justify-between p-4 rounded-lg border-2 border-[#FFB200] bg-gray-50"
            >
              {editingProductId === product.id ? (
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={() => {
                    if (editingName.trim() !== '') {
                      handleProductNameUpdate(product.id, editingName);
                    } else {
                      setEditingProductId(null);
                      setEditingName('');
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && editingName.trim() !== '') {
                      handleProductNameUpdate(product.id, editingName);
                    } else if (e.key === 'Escape') {
                      setEditingProductId(null);
                      setEditingName('');
                    }
                  }}
                  className="text-lg text-[#640D5F] font-medium bg-white rounded-lg border-2 border-[#FFB200] p-1"
                  autoFocus
                />
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => router.push(`/admin/modify/${product.id}`)}
                    className="p-1.5 rounded-lg text-[#640D5F] hover:text-[#FFB200] transition-colors duration-200"
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
                        d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
                      />
                    </svg>
                  </button>
                <span 
                  className="text-lg text-[#640D5F] font-medium cursor-pointer hover:text-[#FFB200]"
                  onClick={() => {
                    setEditingProductId(product.id);
                    setEditingName(product.name);
                  }}
                >
                  {product.name}
                </span>
                </div>
              )}
              
              <div className="flex items-center gap-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAvailabilityToggle(product);
                  }}
                  className={`px-4 py-2 rounded-lg font-medium ${
                    product.available
                      ? 'bg-green-500 hover:bg-green-600'
                      : 'bg-red-500 hover:bg-red-600'
                  } text-white`}
                >
                  {product.available ? 'זמין' : 'לא זמין'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderOrdersList = (orders: Order[], isClosedOrders: boolean = false) => {
    if (orders.length === 0) {
      return <p className="text-center text-gray-500">אין הזמנות {isClosedOrders ? 'סגורות' : 'פתוחות'}</p>;
    }

    return orders.map(order => (
      <div
        key={order.id}
        onClick={() => router.push(`/admin/order/${order.id}`)}
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

  const renderOrdersContent = () => {
    return (
      <div>
        {/* Order Status Tabs */}
        <div className="flex space-x-2 mb-6 border-b border-[#FFB200] overflow-x-auto">
          <button
            onClick={() => setActiveOrderTab('open')}
            className={`px-4 py-2 rounded-t-lg font-medium transition-colors duration-200 whitespace-nowrap ${
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

        {/* Orders List */}
        <div className="space-y-4">
          {activeOrderTab === 'open' 
            ? renderOrdersList(openOrders)
            : activeOrderTab === 'in_progress'
              ? renderOrdersList(inProgressOrders)
              : activeOrderTab === 'closed'
                ? renderOrdersList(closedOrders)
                : activeOrderTab === 'accumulated'
                  ? renderAccumulatedItemsList()
                  : null}
        </div>
      </div>
    );
  };

  const renderContent = () => {
    switch (activeMainTab) {
      case 'products':
        return renderProductsContent();
      case 'orders':
        return renderOrdersContent();
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#640D5F] to-[#D91656] p-4">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-xl p-6">
        <div className="relative flex items-center justify-between mb-6">
          <div className="absolute left-0 flex items-center gap-4">
            <button
              onClick={() => router.push('/admin/new')}
              className="p-2 rounded-lg transition-colors duration-200 text-[#640D5F] hover:text-[#FFB200]"
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                fill="none" 
                viewBox="0 0 24 24" 
                strokeWidth={1.5} 
                stroke="currentColor" 
                className="w-6 h-6"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
          </div>
          <h1 className="text-2xl font-bold text-[#640D5F] text-center w-full">
            {activeMainTab === 'products' ? 'ניהול מוצרים' : 'ניהול הזמנות'}
          </h1>
        </div>
        
        {/* Main Tabs */}
        <div className="flex space-x-2 mb-6 border-b border-[#FFB200] overflow-x-auto">
          <button
            onClick={() => setActiveMainTab('products')}
            className={`px-4 py-2 rounded-t-lg font-medium transition-colors duration-200 whitespace-nowrap ${
              activeMainTab === 'products'
                ? 'bg-[#FFB200] text-white'
                : 'text-[#640D5F] hover:bg-[#FFB200]/20'
            }`}
          >
            ניהול מוצרים
          </button>
          <button
            onClick={() => setActiveMainTab('orders')}
            className={`px-4 py-2 rounded-t-lg font-medium transition-colors duration-200 whitespace-nowrap ${
              activeMainTab === 'orders'
                ? 'bg-[#FFB200] text-white'
                : 'text-[#640D5F] hover:bg-[#FFB200]/20'
            }`}
          >
            הזמנות
          </button>
        </div>

        {renderContent()}
      </div>
    </div>
  );
} 