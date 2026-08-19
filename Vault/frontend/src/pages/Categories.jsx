import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  RefreshCw,
  Save,
  Search,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import Header from '../components/Header';
import {
  addCategoryKeyword,
  createCategory,
  deleteCategoryKeyword,
  disableCategory,
  listCategories,
  updateCategory,
} from '../lib/whatsapp-api';

const emptyForm = { name: '', emoji: '🏷️', type: 'expense', keywords: '' };

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [keywordDrafts, setKeywordDrafts] = useState({});
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const fetchCategories = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await listCategories();
      setCategories(result.categories || []);
    } catch (err) {
      setError(err.message || 'Kategori gagal dimuat.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const visibleCategories = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return categories;
    return categories.filter((category) => {
      const haystack = [
        category.name,
        category.emoji,
        category.type,
        ...(category.items || []).map((item) => item.keyword),
      ].join(' ').toLowerCase();
      return haystack.includes(normalized);
    });
  }, [categories, query]);

  const activeCategories = visibleCategories.filter((category) => category.is_active);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const payload = {
        name: form.name,
        emoji: form.emoji,
        type: form.type,
        keywords: form.keywords.split(',').map((item) => item.trim()).filter(Boolean),
        is_active: true,
      };
      if (editingId) {
        await updateCategory(editingId, payload);
        setNotice('Kategori berhasil diperbarui.');
      } else {
        await createCategory(payload);
        setNotice('Kategori baru berhasil dibuat.');
      }
      setForm(emptyForm);
      setEditingId(null);
      await fetchCategories();
    } catch (err) {
      setError(err.message || 'Kategori gagal disimpan.');
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (category) => {
    setEditingId(category.id);
    setForm({
      name: category.name,
      emoji: category.emoji || '🏷️',
      type: category.type || 'expense',
      keywords: (category.items || []).map((item) => item.keyword).join(', '),
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
  };

  const handleDisable = async (category) => {
    setBusy(true);
    setError('');
    try {
      await disableCategory(category.id);
      setNotice(`Kategori ${category.name} dinonaktifkan.`);
      await fetchCategories();
    } catch (err) {
      setError(err.message || 'Kategori gagal dinonaktifkan.');
    } finally {
      setBusy(false);
    }
  };

  const handleAddKeyword = async (category) => {
    const keyword = (keywordDrafts[category.id] || '').trim();
    if (!keyword) return;
    setBusy(true);
    setError('');
    try {
      await addCategoryKeyword(category.id, keyword);
      setKeywordDrafts((current) => ({ ...current, [category.id]: '' }));
      setNotice(`Item “${keyword}” masuk ke ${category.name}.`);
      await fetchCategories();
    } catch (err) {
      setError(err.message || 'Item gagal ditambahkan.');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteKeyword = async (category, item) => {
    setBusy(true);
    setError('');
    try {
      await deleteCategoryKeyword(category.id, item.id);
      setNotice(`Item “${item.keyword}” dihapus.`);
      await fetchCategories();
    } catch (err) {
      setError(err.message || 'Item gagal dihapus.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Header
        title="Kategori"
        subtitle="Atur kategori, emoji, dan item yang dipakai bot WhatsApp untuk klasifikasi otomatis."
      />

      {(notice || error) && (
        <div className={`rounded-2xl border px-5 py-4 text-sm ${
          error
            ? 'border-red-500/30 bg-red-500/10 text-red-200'
            : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
        }`}
        >
          {error || notice}
        </div>
      )}

      <section className="grid gap-5 lg:grid-cols-[420px_1fr]">
        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-800 bg-[#0c1822] p-6 shadow-xl shadow-black/10">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300">
              <Tag className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">{editingId ? 'Edit Kategori' : 'Kategori Baru'}</h2>
              <p className="text-sm text-slate-400">Contoh: Snack 🍟 dengan item gorengan, risol, roti.</p>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div className="grid grid-cols-[92px_1fr] gap-3">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Emoji</label>
                <input
                  value={form.emoji}
                  onChange={(event) => setForm((current) => ({ ...current, emoji: event.target.value }))}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-center text-2xl outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Nama</label>
                <input
                  required
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Snack"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm text-white outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Tipe</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ['expense', 'Pengeluaran'],
                  ['income', 'Pemasukan'],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setForm((current) => ({ ...current, type: value }))}
                    className={`rounded-xl py-2.5 text-sm font-semibold transition ${
                      form.type === value
                        ? 'bg-emerald-500 text-[#071019]'
                        : 'border border-slate-700 text-slate-300 hover:border-emerald-500/60'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Item / kata kunci</label>
              <textarea
                rows={4}
                value={form.keywords}
                onChange={(event) => setForm((current) => ({ ...current, keywords: event.target.value }))}
                placeholder="gorengan, risol, roti, cemilan"
                className="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm text-white outline-none focus:border-emerald-500"
              />
              <p className="mt-2 text-xs text-slate-500">Pisahkan pakai koma. Bot akan memilih match paling spesifik.</p>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            {editingId && (
              <button
                type="button"
                onClick={cancelEdit}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-800"
              >
                <X className="h-4 w-4" /> Batal
              </button>
            )}
            <button
              type="submit"
              disabled={busy}
              className="ml-auto inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-[#071019] transition hover:bg-emerald-400 disabled:opacity-50"
            >
              <Save className="h-4 w-4" /> {editingId ? 'Update' : 'Simpan'}
            </button>
          </div>
        </form>

        <section className="rounded-2xl border border-slate-800 bg-[#0c1822]">
          <div className="flex flex-col gap-4 border-b border-slate-800 p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Daftar Kategori</h2>
              <p className="text-sm text-slate-400">{activeCategories.length} kategori aktif dipakai bot WhatsApp.</p>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-300">
                <Search className="h-4 w-4 text-slate-500" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Cari kategori/item"
                  className="w-44 bg-transparent outline-none placeholder:text-slate-500"
                />
              </label>
              <button
                type="button"
                onClick={fetchCategories}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} /> Refresh
              </button>
            </div>
          </div>

          <div className="grid gap-4 p-5 xl:grid-cols-2">
            {activeCategories.map((category) => (
              <article key={category.id} className="rounded-2xl border border-slate-800 bg-[#071019] p-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/12 text-2xl">
                    {category.emoji || '🏷️'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-base font-semibold text-white">{category.name}</h3>
                      <span className="rounded-full border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                        {category.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(category.items || []).length ? category.items.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleDeleteKeyword(category, item)}
                          className="rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1 text-xs text-slate-300 hover:border-red-400/70 hover:text-red-200"
                          title="Klik untuk hapus item"
                        >
                          {item.keyword}
                        </button>
                      )) : (
                        <span className="text-sm text-slate-500">Belum ada item.</span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(category)}
                      className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDisable(category)}
                      className="rounded-lg border border-red-500/30 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  <input
                    value={keywordDrafts[category.id] || ''}
                    onChange={(event) => setKeywordDrafts((current) => ({ ...current, [category.id]: event.target.value }))}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        handleAddKeyword(category);
                      }
                    }}
                    placeholder={`Tambah item untuk ${category.name}`}
                    className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-2.5 text-sm text-white outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddKeyword(category)}
                    disabled={busy}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-[#071019] hover:bg-emerald-400 disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" /> Item
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}
