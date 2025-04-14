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

type MainTab = 'products' | 'orders';
type OrderTab = 'open' | 'in_progress' | 'closed';

export default function AdminPage() {
  const [activeMainTab, setActiveMainTab] = useState<MainTab>('products');
  const [activeOrderTab, setActiveOrderTab] = useState<OrderTab>('open');
  const [products, setProducts] = useState<Product[]>([]);
  const [openOrders, setOpenOrders] = useState<Order[]>([]);
  const [inProgressOrders, setInProgressOrders] = useState<Order[]>([]);
  const [closedOrders, setClosedOrders] = useState<Order[]>([]);
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
                <span 
                  className="text-lg text-[#640D5F] font-medium cursor-pointer hover:text-[#FFB200]"
                  onClick={() => {
                    setEditingProductId(product.id);
                    setEditingName(product.name);
                  }}
                >
                  {product.name}
                </span>
              )}
              
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">{product.category}</span>
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
        </div>

        {/* Orders List */}
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
        <h1 className="text-2xl font-bold mb-6 text-[#640D5F] text-center">ניהול מערכת</h1>
        
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