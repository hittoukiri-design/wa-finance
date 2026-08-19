import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from './useAuth';
import { getSettings, listExpenses } from '../lib/firestore';

const FilterContext = createContext(null);

function dateInputValue(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function FilterProvider({ children }) {
  const { user } = useAuth();

  const defaultStart = useMemo(() => {
    const now = new Date();
    return dateInputValue(new Date(now.getFullYear(), now.getMonth(), 1));
  }, []);

  const defaultEnd = useMemo(() => {
    const now = new Date();
    return dateInputValue(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  }, []);

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [wallet, setWallet] = useState('Semua dompet');
  const [category, setCategory] = useState('Semua kategori');
  const [walletsList, setWalletsList] = useState(['BCA', 'SUPERBANK', 'Cash', 'GoPay', 'DANA']);
  const [categoriesList, setCategoriesList] = useState([
    'Makan', 'Belanja', 'Transportasi', 'Tagihan', 'Rumah', 'Kesehatan', 'Pendidikan', 'Hiburan', 'Perawatan', 'Sosial', 'Keluarga', 'Tabungan', 'Investasi', 'Gaji', 'Lainnya'
  ]);

  // Load user's configured wallets and categories
  useEffect(() => {
    if (!user?.uid) return;
    let active = true;
    Promise.all([getSettings(user.uid), listExpenses(user.uid)])
      .then(([settings, expenses]) => {
        if (!active) return;
        const customWallets = (settings?.wallets || []).map((w) => w.name);
        const txWallets = (expenses || []).map((e) => e.payment_channel || e.rekening).filter(Boolean);
        const allWallets = Array.from(new Set([...customWallets, ...txWallets, 'Cash', 'BCA', 'SUPERBANK', 'GoPay', 'DANA']));
        setWalletsList(allWallets);

        const customCategories = (settings?.category_budgets || []).map((c) => c.name);
        const defaultCats = [
          'Makan', 'Belanja', 'Transportasi', 'Tagihan', 'Rumah', 'Kesehatan', 'Pendidikan', 'Hiburan', 'Perawatan', 'Sosial', 'Keluarga', 'Tabungan', 'Investasi', 'Gaji', 'Lainnya'
        ];
        const allCats = Array.from(new Set([...customCategories, ...defaultCats]));
        setCategoriesList(allCats);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [user?.uid]);

  const isFiltered = useMemo(() => {
    return (
      startDate !== defaultStart ||
      endDate !== defaultEnd ||
      wallet !== 'Semua dompet' ||
      category !== 'Semua kategori'
    );
  }, [startDate, endDate, wallet, category, defaultStart, defaultEnd]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (startDate !== defaultStart || endDate !== defaultEnd) count++;
    if (wallet !== 'Semua dompet') count++;
    if (category !== 'Semua kategori') count++;
    return count;
  }, [startDate, endDate, wallet, category, defaultStart, defaultEnd]);

  const applyFilters = useCallback(({ startDate: s, endDate: e, wallet: w, category: c }) => {
    if (s !== undefined) setStartDate(s);
    if (e !== undefined) setEndDate(e);
    if (w !== undefined) setWallet(w);
    if (c !== undefined) setCategory(c);
  }, []);

  const resetFilters = useCallback(() => {
    setStartDate(defaultStart);
    setEndDate(defaultEnd);
    setWallet('Semua dompet');
    setCategory('Semua kategori');
  }, [defaultStart, defaultEnd]);

  return (
    <FilterContext.Provider
      value={{
        startDate,
        endDate,
        wallet,
        category,
        walletsList,
        categoriesList,
        isFiltered,
        activeFiltersCount,
        applyFilters,
        resetFilters,
        defaultStart,
        defaultEnd,
      }}
    >
      {children}
    </FilterContext.Provider>
  );
}

export function useFilter() {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error('useFilter must be used within a FilterProvider');
  }
  return context;
}
