'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

const ADMIN_STORE_ID = "1"; // Admin is store ID 1

const stores = [
  { id: 1, name: 'אלי כהן' },
  { id: 2, name: 'אלי כהן 2' },
  { id: 3, name: 'אלי כהן 3' },
  { id: 4, name: 'אלי כהן 4' },
  { id: 5, name: 'אלי כהן 5' },
  { id: 6, name: 'אלי כהן 6' },
  { id: 7, name: 'מחסן' },
  { id: 8, name: 'tv' }  // Add TV store
];

export default function Home() {
  const [selectedStore, setSelectedStore] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .eq('id', selectedStore)
      .eq('password', password)
      .single();

    if (error || !data) {
      setError('סיסמא לא נכונה');
      return;
    }

    localStorage.setItem('storeId', data.id.toString());
    localStorage.setItem('isAdmin', (data.id.toString() === ADMIN_STORE_ID).toString());
    
    switch (data.id.toString()) {
      case ADMIN_STORE_ID:
        router.push('/admin');
        break;
      case "7":  // Warehouse
        router.push('/mahsan');
        break;
      case "8":  // TV
        router.push('/tv');
        break;
      default:
        router.push('/order');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#640D5F] to-[#D91656]">
      <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md mx-4">
        <h1 className="text-3xl font-bold mb-6 text-center text-[#640D5F]">כניסה למערכת</h1>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-lg font-medium text-[#640D5F]">
              בחר חנות
            </label>
            <select
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
              className="mt-1 block w-full rounded-lg border-2 border-[#FFB200] p-2 focus:border-[#EB5B00] focus:ring-[#EB5B00] text-violet-700"
              required
            >
              <option value="">בחר חנות...</option>
              <option value="2">שטמפפר</option>
              <option value="3">סמילנסקי</option>
              <option value="4">חפץ חיים</option>
              <option value="5">קריית השרון</option>
              <option value="6">פתח תקווה</option>
              <option value="1">בק אופיס</option>
              <option value="7">מחסן</option>
              <option value="8">tv</option>
            </select>
          </div>

          <div>
            <label className="block text-lg font-medium text-[#640D5F]">
              סיסמה
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-lg border-2 border-[#FFB200] p-2 focus:border-[#EB5B00] focus:ring-[#EB5B00] text-violet-700"
              required
            />
          </div>

          {error && (
            <p className="text-[#D91656] text-sm font-bold">{error}</p>
          )}

          <button
            type="submit"
            className="w-full py-3 px-4 rounded-lg font-bold text-white bg-[#EB5B00] hover:bg-[#FFB200] transition-colors duration-200"
          >
            כניסה
          </button>
        </form>
      </div>
    </div>
  );
} 