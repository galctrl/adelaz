'use client';

import { useEffect, useState, use } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Product } from '@/types';

export default function ModifyProductPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [available, setAvailable] = useState(true);
  const [thaiProductName, setThaiProductName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchProduct();
  }, []);

  const fetchProduct = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', resolvedParams.id)
        .single();

      if (error) throw error;

      if (data) {
        setSku(data.id.toString());
        setName(data.name);
        setCategory(data.category);
        setPrice(data.price.toString());
        setAvailable(data.available);
        setThaiProductName(data.thai_product_name);
      }
    } catch (error) {
      console.error('Error fetching product:', error);
      alert('שגיאה בטעינת המוצר');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('products')
        .update({
          id: parseInt(sku),
          name,
          category,
          price: parseFloat(price),
          available,
          thai_product_name: thaiProductName
        })
        .eq('id', resolvedParams.id);

      if (error) throw error;

      router.push('/admin');
    } catch (error) {
      console.error('Error updating product:', error);
      alert('שגיאה בעדכון המוצר');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#640D5F] to-[#D91656] p-4">
        <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-xl p-6">
          <div className="text-center text-[#640D5F]">טוען...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#640D5F] to-[#D91656] p-4">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-xl p-6">
        <div className="relative flex items-center justify-between mb-6">
          <button
            onClick={() => router.push('/admin')}
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
            עריכת מוצר
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-[#640D5F]">
              מקט
            </label>
            <input
              type="number"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              required
              className="w-full rounded-lg border-2 border-[#FFB200] p-2 text-[#640D5F] focus:border-[#EB5B00] focus:ring-[#EB5B00]"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-[#640D5F]">
              שם המוצר
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-lg border-2 border-[#FFB200] p-2 text-[#640D5F] focus:border-[#EB5B00] focus:ring-[#EB5B00]"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-[#640D5F]">
              קטגוריה
            </label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
              className="w-full rounded-lg border-2 border-[#FFB200] p-2 text-[#640D5F] focus:border-[#EB5B00] focus:ring-[#EB5B00]"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-[#640D5F]">
              מחיר
            </label>
            <input
              type="number"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
              className="w-full rounded-lg border-2 border-[#FFB200] p-2 text-[#640D5F] focus:border-[#EB5B00] focus:ring-[#EB5B00]"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-[#640D5F]">
              שם המוצר בתאית
            </label>
            <input
              type="text"
              value={thaiProductName}
              onChange={(e) => setThaiProductName(e.target.value)}
              required
              className="w-full rounded-lg border-2 border-[#FFB200] p-2 text-[#640D5F] focus:border-[#EB5B00] focus:ring-[#EB5B00]"
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border-2 border-[#FFB200]">
            <label className="inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={available}
                onChange={() => setAvailable(!available)}
              />
              <div className="relative w-11 h-6 bg-gray-200 h-6 bg-gray-200 peer-focus:outline-none dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 dark:peer-checked:bg-green-600"></div>
              <span className="mr-3 text-base font-medium text-[#640D5F]">
                {available ? 'זמין' : 'לא זמין'}
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 px-4 rounded-lg font-bold text-white bg-[#EB5B00] hover:bg-[#FFB200] transition-colors duration-200 disabled:opacity-50"
          >
            {isSubmitting ? 'שומר...' : 'שמור שינויים'}
          </button>
        </form>
      </div>
    </div>
  );
} 