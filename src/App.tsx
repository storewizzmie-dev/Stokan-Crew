/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Pencil,
  Check,
  Plus,
  Trash2,
  RotateCcw,
  Send,
  Copy,
  X,
  GripVertical,
  AlertCircle,
  Eye,
  Sparkles,
  Layers,
} from 'lucide-react';

interface Slot {
  v: string;
  u: string;
}

interface Item {
  id: string;
  name: string;
  slots: Slot[];
}

const LS_KEY = 'sisa-fisik:v1';

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const mk = (name: string, ...units: string[]): Item => ({
  id: uid(),
  name,
  slots: units.map((u) => ({ v: '', u })),
});

const getDefaultItems = (): Item[] => [
  mk('Karage', 'pack'),
  mk('Sayap', 'pack', 'porsi'),
  mk('Ayam filet', 'porsi'),
  mk('Ayam kecil', 'pack', 'porsi'),
  mk('Ayam besar', 'pack', 'porsi'),
  mk('Ebi', 'pcs'),
  mk('Timun', ''),
  mk('Crabstik', ''),
  mk('Koslow', ''),
  mk('Selada', ''),
  mk('Saos Black paper', ''),
  mk('Saos teriyaki', ''),
  mk('Saos Asam manis', 'btl', ''),
  mk('Saos pedas', ''),
  mk('Cuka', ''),
  mk('Kwipie', 'pack', ''),
  mk('Mestro', ''),
  mk('Mentai', ''),
  mk('Wijen', ''),
  mk('Minyak', ''),
  mk('Tobiko', ''),
  mk('Ricepaper', 'lembar'),
  mk('Mika', 'pcs'),
  mk('Cup(35)', 'pcs'),
  mk('Sambal horeg', '', ''),
  mk('Nasi', 'kg', 'kg', 'kg'),
  mk('Nori', 'pack', 'lembar'),
  mk('Klip besar', 'pack', 'pcs'),
  mk('Klip sedang', 'pack', 'pcs'),
  mk('Klip kecil', 'pcs'),
  mk('Tepung wfc', 'pack'),
];

const PRIMARY_UNITS = ['pack', 'pcs', 'porsi', 'kg', 'gram'];
const EXTRA_UNITS = ['btl', 'lembar', 'liter', 'ml', 'dus', 'box', 'sachet', 'ikat'];

const todayKey = () => {
  const d = new Date();
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  );
};

const fullDate = () =>
  new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

const isItemFilled = (item: Item) => item.slots.some((s) => s.v.trim() !== '');

export default function App() {
  const [items, setItems] = useState<Item[]>(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return getDefaultItems();
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.items)) return getDefaultItems();
      const loadedItems: Item[] = parsed.items
        .filter((i: unknown) => i && typeof i === 'object')
        .map((i: Record<string, unknown>) => ({
          id: String(i.id || uid()),
          name: String(i.name || 'Barang'),
          slots: (Array.isArray(i.slots) && i.slots.length ? i.slots : [{ v: '', u: '' }]).map(
            (s: Record<string, unknown>) => ({
              v: String((s && s.v) || ''),
              u: String((s && s.u) || ''),
            })
          ),
        }));

      const currentDay = todayKey();
      if (parsed.day && parsed.day !== currentDay) {
        return loadedItems.map((it) => ({
          ...it,
          slots: it.slots.map((s) => ({ ...s, v: '' })),
        }));
      }
      return loadedItems;
    } catch {
      return getDefaultItems();
    }
  });

  const [isEditMode, setIsEditMode] = useState(false);

  // Unit Picker Popup State
  const [unitPopup, setUnitPopup] = useState<{
    itemId: string;
    itemName: string;
    mode: 'add' | 'edit';
    slotIndex?: number;
    currentUnit?: string;
  } | null>(null);
  const [customUnitText, setCustomUnitText] = useState('');

  // Add New Item Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUnits, setNewUnits] = useState<string[]>(['pack']);

  // Preview & Confirm Modals
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    cancelLabel: string;
    danger?: boolean;
    onConfirm: () => void;
  } | null>(null);

  // Toast State
  const [toast, setToast] = useState<{
    message: string;
    undoAction?: () => void;
  } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  // Direct DOM 120fps Drag & Drop Refs
  const editListRef = useRef<HTMLDivElement>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settlingRef = useRef(false);
  const dragRef = useRef<{
    active: boolean;
    el: HTMLElement;
    grip: HTMLElement;
    els: HTMLElement[];
    from: number;
    target: number;
    tops: number[];
    hs: number[];
    gap: number;
    startY: number;
    startScroll: number;
    clientY: number;
    pid: number;
    raf: number;
  } | null>(null);

  const showToast = (message: string, undoAction?: () => void) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, undoAction });
    toastTimerRef.current = setTimeout(
      () => setToast(null),
      undoAction ? 5000 : 2500
    );
  };

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        LS_KEY,
        JSON.stringify({
          items,
          theme: 'light',
          day: todayKey(),
        })
      );
    } catch {
      // ignore storage quota errors
    }
  }, [items]);

  const totalCount = items.length;
  const filledCount = useMemo(() => items.filter(isItemFilled).length, [items]);
  const progressPercent = totalCount > 0 ? Math.round((filledCount / totalCount) * 100) : 0;

  // Normal Mode: Fill values
  const handleValueChange = (itemId: string, slotIndex: number, val: string) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        const nextSlots = it.slots.map((s, idx) => (idx === slotIndex ? { ...s, v: val } : s));
        return { ...it, slots: nextSlots };
      })
    );
  };

  const handleValueKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const allInputs = Array.from(
        document.querySelectorAll<HTMLInputElement>('input[data-slot-val="true"]')
      );
      const currentIndex = allInputs.indexOf(e.currentTarget);
      const nextInput = allInputs[currentIndex + 1];
      if (nextInput) {
        nextInput.focus();
        nextInput.select();
        nextInput.scrollIntoView({ block: 'center', behavior: 'smooth' });
      } else {
        e.currentTarget.blur();
      }
    }
  };

  // Edit Mode: Item Name & Slots
  const handleNameChange = (itemId: string, name: string) => {
    setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, name } : it)));
  };

  const handleNameBlur = (itemId: string, name: string) => {
    if (!name.trim()) {
      setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, name: 'Barang' } : it)));
    }
  };

  const handleSelectUnitFromPopup = (selectedUnit: string) => {
    if (!unitPopup) return;
    const { itemId, mode, slotIndex } = unitPopup;

    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        if (mode === 'add') {
          return {
            ...it,
            slots: [...it.slots, { v: '', u: selectedUnit }],
          };
        } else if (mode === 'edit' && typeof slotIndex === 'number') {
          return {
            ...it,
            slots: it.slots.map((s, idx) =>
              idx === slotIndex ? { ...s, u: selectedUnit } : s
            ),
          };
        }
        return it;
      })
    );

    setUnitPopup(null);
    setCustomUnitText('');
  };

  const handleRemoveSlot = (itemId: string, slotIndex: number) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId || it.slots.length <= 1) return it;
        return { ...it, slots: it.slots.filter((_, idx) => idx !== slotIndex) };
      })
    );
  };

  const handleDeleteItem = (item: Item, index: number) => {
    setItems((prev) => prev.filter((it) => it.id !== item.id));
    showToast(`"${item.name}" dihapus`, () => {
      setItems((prev) => {
        const next = [...prev];
        next.splice(Math.min(index, next.length), 0, item);
        return next;
      });
    });
  };

  const handleCreateItem = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newName.trim();
    if (!trimmedName) return;

    const cleanUnits = newUnits.length > 0 ? newUnits : [''];
    const newItem: Item = {
      id: uid(),
      name: trimmedName,
      slots: cleanUnits.map((u) => ({ v: '', u })),
    };

    setItems((prev) => [...prev, newItem]);
    setShowAddModal(false);
    setNewName('');
    setNewUnits(['pack']);
    setHighlightedId(newItem.id);
    showToast(`"${trimmedName}" berhasil ditambahkan`);

    setTimeout(() => {
      const row = document.getElementById(`item-row-${newItem.id}`);
      row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 120);
    setTimeout(() => setHighlightedId(null), 2200);
  };

  /* ============================================================================
   * 120FPS ZERO-DELAY HOLD & DRAG ENGINE (Direct DOM Transform + Spring Physics)
   * ============================================================================ */
  const updateDragPosition = () => {
    const d = dragRef.current;
    if (!d || !d.active) return;

    const last = d.els.length - 1;
    const rawDy = d.clientY - d.startY + (window.scrollY - d.startScroll);
    const minDy = d.tops[0] - d.tops[d.from];
    const maxDy = d.tops[last] + d.hs[last] - (d.tops[d.from] + d.hs[d.from]);
    const dy = Math.max(minDy, Math.min(maxDy, rawDy));

    // Direct 1:1 hardware-accelerated translate with zero lag
    d.el.style.translate = `0 ${dy}px`;

    const draggedCenter = d.tops[d.from] + d.hs[d.from] / 2 + dy;
    let newTarget = d.from;

    for (let j = d.from + 1; j < d.els.length; j++) {
      if (draggedCenter > d.tops[j] + d.hs[j] / 2) newTarget = j;
    }
    for (let j = d.from - 1; j >= 0; j--) {
      if (draggedCenter < d.tops[j] + d.hs[j] / 2) newTarget = j;
    }

    if (newTarget !== d.target) {
      d.target = newTarget;
      const shiftH = d.hs[d.from] + d.gap;
      d.els.forEach((cardEl, j) => {
        if (j === d.from) return;
        let offset = 0;
        if (newTarget > d.from && j > d.from && j <= newTarget) offset = -shiftH;
        else if (newTarget < d.from && j >= newTarget && j < d.from) offset = shiftH;
        cardEl.style.translate = offset ? `0 ${offset}px` : '';
      });
      if (navigator.vibrate) navigator.vibrate(8);
    }
  };

  const runAutoScroll = () => {
    const d = dragRef.current;
    if (!d || !d.active) return;

    const topEdge = 115;
    const bottomEdge = window.innerHeight - 95;
    let v = 0;

    if (d.clientY < topEdge) {
      v = -Math.min(16, (topEdge - d.clientY) / 4 + 2);
    } else if (d.clientY > bottomEdge) {
      v = Math.min(16, (d.clientY - bottomEdge) / 4 + 2);
    }

    if (v !== 0) {
      const prevY = window.scrollY;
      window.scrollBy(0, v);
      if (window.scrollY !== prevY) updateDragPosition();
    }

    d.raf = requestAnimationFrame(runAutoScroll);
  };

  const handleGripPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (dragRef.current || settlingRef.current) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    const grip = e.currentTarget;
    const cardEl = grip.closest('.edit-item-card') as HTMLElement | null;
    const listEl = editListRef.current;
    if (!cardEl || !listEl) return;

    const startY = e.clientY;
    const pid = e.pointerId;

    // Visual feedback immediately when pressing
    cardEl.classList.add('is-holding');

    // Hold for 150ms to lift and start dragging ("harus di tahan")
    holdTimerRef.current = setTimeout(() => {
      holdTimerRef.current = null;
      const els = Array.from(listEl.children) as HTMLElement[];
      const fromIndex = els.indexOf(cardEl);
      if (fromIndex < 0) {
        cardEl.classList.remove('is-holding');
        return;
      }

      const sy = window.scrollY;
      const rects = els.map((c) => c.getBoundingClientRect());
      let gap = 10;
      if (els.length > 1) {
        gap = rects[1].top - rects[0].bottom;
      }

      dragRef.current = {
        active: true,
        el: cardEl,
        grip,
        els,
        from: fromIndex,
        target: fromIndex,
        tops: rects.map((r) => r.top + sy),
        hs: rects.map((r) => r.height),
        gap,
        startY,
        startScroll: sy,
        clientY: startY,
        pid,
        raf: 0,
      };

      try {
        grip.setPointerCapture(pid);
      } catch {
        // ignore
      }

      cardEl.classList.remove('is-holding');
      cardEl.classList.add('is-dragging');
      document.body.classList.add('dragging-active');
      if (navigator.vibrate) navigator.vibrate(20);

      runAutoScroll();
    }, 150);
  };

  const handleGripPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    // If not yet activated (still within 150ms hold window), cancel if user scrolls away
    if (!dragRef.current) {
      return;
    }
    e.preventDefault();
    dragRef.current.clientY = e.clientY;
    updateDragPosition();
  };

  const finishDrag = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    const listEl = editListRef.current;
    if (listEl) {
      listEl.querySelectorAll('.is-holding').forEach((el) => el.classList.remove('is-holding'));
    }

    const d = dragRef.current;
    if (!d) return;

    dragRef.current = null;
    settlingRef.current = true;
    cancelAnimationFrame(d.raf);

    try {
      d.grip.releasePointerCapture(d.pid);
    } catch {
      // ignore
    }

    const { from, target } = d;
    let finalTranslateY = 0;
    if (target > from) {
      finalTranslateY = d.tops[target] + d.hs[target] - d.hs[from] - d.tops[from];
    } else if (target < from) {
      finalTranslateY = d.tops[target] - d.tops[from];
    }

    d.el.classList.remove('is-dragging');
    d.el.classList.add('is-dropping');
    d.el.style.translate = `0 ${finalTranslateY}px`;

    setTimeout(() => {
      if (listEl) listEl.classList.add('no-drag-anim');

      d.els.forEach((c) => {
        c.style.translate = '';
        c.classList.remove('is-dropping');
      });

      if (target !== from) {
        setItems((prev) => {
          const next = [...prev];
          const [moved] = next.splice(from, 1);
          next.splice(target, 0, moved);
          return next;
        });
      }

      requestAnimationFrame(() => {
        if (listEl) {
          void listEl.offsetHeight;
          listEl.classList.remove('no-drag-anim');
        }
        document.body.classList.remove('dragging-active');
        settlingRef.current = false;
      });
    }, 340);
  };

  // Clear all values
  const handleClearValues = () => {
    if (filledCount === 0) {
      showToast('Semua isian angka sudah kosong');
      return;
    }
    setConfirmDialog({
      title: 'Kosongkan Semua Angka?',
      message:
        'Semua angka stok yang sudah diisi hari ini akan dikosongkan. Daftar barang dan satuan tetap tersimpan.',
      confirmLabel: 'Ya, Kosongkan',
      cancelLabel: 'Batal',
      danger: true,
      onConfirm: () => {
        setItems((prev) =>
          prev.map((it) => ({
            ...it,
            slots: it.slots.map((s) => ({ ...s, v: '' })),
          }))
        );
        setConfirmDialog(null);
        showToast('Semua angka dikosongkan');
      },
    });
  };

  // Format report & Send to WhatsApp
  const formatItemLine = (it: Item) => {
    const parts = it.slots
      .filter((s) => s.v.trim() !== '')
      .map((s) => s.v.trim() + (s.u.trim() ? ' ' + s.u.trim() : ''));
    return (it.name.trim() || 'Barang') + ' ' + (parts.length ? parts.join(' + ') : '-');
  };

  const buildReportMessage = () => {
    const head = `*Sisa Fisik* – ${fullDate()}`;
    return `${head}\n\n` + items.map(formatItemLine).join('\n');
  };

  const launchConfetti = () => {
    const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#6366f1'];
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight - 60;
    for (let i = 0; i < 28; i++) {
      const el = document.createElement('div');
      const angle = Math.random() * Math.PI * 2;
      const velocity = 65 + Math.random() * 135;
      const dx = Math.cos(angle) * velocity;
      const dy = Math.sin(angle) * velocity - 95;
      const rot = Math.random() * 520 - 260;
      el.style.cssText = `
        position:fixed;left:${cx}px;top:${cy}px;width:8px;height:12px;
        background:${colors[i % colors.length]};border-radius:2px;
        pointer-events:none;z-index:100;
        transition:transform 0.85s cubic-bezier(0.16,1,0.3,1), opacity 0.85s ease;
      `;
      document.body.appendChild(el);
      requestAnimationFrame(() => {
        el.style.transform = `translate(${dx}px, ${dy}px) rotate(${rot}deg)`;
        el.style.opacity = '0';
      });
      setTimeout(() => el.remove(), 900);
    }
  };

  const openWhatsAppNow = () => {
    const msg = buildReportMessage();
    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    try {
      navigator.clipboard.writeText(msg);
    } catch {
      // ignore
    }
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleSendWhatsApp = () => {
    if (items.length === 0) {
      showToast('Daftar barang masih kosong');
      return;
    }
    const missing = items.filter((i) => !isItemFilled(i));
    if (missing.length > 0) {
      const sampleNames =
        missing
          .slice(0, 5)
          .map((i) => i.name)
          .join(', ') + (missing.length > 5 ? `, dan ${missing.length - 5} lainnya` : '');

      setConfirmDialog({
        title: `Masih ada ${missing.length} barang belum diisi`,
        message: `Belum diisi: ${sampleNames}. Barang yang kosong akan otomatis ditulis "-" di laporan WhatsApp.`,
        confirmLabel: 'Tetap Kirim ke WA',
        cancelLabel: 'Isi Dulu',
        onConfirm: () => {
          setConfirmDialog(null);
          openWhatsAppNow();
        },
      });
      return;
    }
    launchConfetti();
    openWhatsAppNow();
  };

  const handleCopyReport = async () => {
    const msg = buildReportMessage();
    try {
      await navigator.clipboard.writeText(msg);
      showToast('Teks laporan berhasil disalin!');
    } catch {
      setShowPreviewModal(true);
    }
  };

  return (
    <div className="min-h-dvh bg-[#f4f6fb] text-slate-900 pb-26">
      {/* Top Sticky Header */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-xl border-b border-slate-200/80 shadow-2xs">
        <div className="max-w-2xl mx-auto px-3.5 py-2.5">
          <div className="flex items-center justify-between gap-2">
            {/* Brand Title & Date */}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900">
                  Sisa Fisik
                </h1>
                <motion.span
                  key={filledCount}
                  initial={{ scale: 1.25, color: '#059669' }}
                  animate={{ scale: 1, color: '#64748b' }}
                  transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                  className="text-xs font-bold text-slate-500 tabular-nums shrink-0"
                >
                  {filledCount}/{totalCount} terisi
                </motion.span>
              </div>
              <p className="text-xs font-medium text-slate-400 truncate">{fullDate()}</p>
            </div>

            {/* Right Controls: Reset & Edit */}
            <div className="flex items-center gap-2 shrink-0">
              {!isEditMode && (
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  type="button"
                  onClick={handleClearValues}
                  title="Kosongkan angka"
                  className="h-9 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                  <span>Reset</span>
                </motion.button>
              )}

              <motion.button
                whileTap={{ scale: 0.92 }}
                type="button"
                onClick={() => setIsEditMode((prev) => !prev)}
                className={`h-9 px-4 rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  isEditMode
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/25'
                    : 'bg-slate-900 hover:bg-slate-800 text-white shadow-sm'
                }`}
              >
                {isEditMode ? (
                  <>
                    <Check className="w-4 h-4 stroke-[2.75]" />
                    <span>Selesai Edit</span>
                  </>
                ) : (
                  <>
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </>
                )}
              </motion.button>
            </div>
          </div>

          {/* Animated Progress Bar */}
          <div className="mt-2 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ type: 'spring', stiffness: 140, damping: 22 }}
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-3.5 pt-3">
        {items.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-slate-200 rounded-2xl p-8 text-center my-4 shadow-2xs"
          >
            <p className="text-sm font-bold text-slate-800 mb-1">Daftar barang masih kosong</p>
            <p className="text-xs text-slate-500 mb-4">
              Klik tombol di bawah untuk mulai menambahkan barang stok.
            </p>
            <motion.button
              whileTap={{ scale: 0.95 }}
              type="button"
              onClick={() => {
                setIsEditMode(true);
                setShowAddModal(true);
              }}
              className="px-4 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Barang Sekarang</span>
            </motion.button>
          </motion.div>
        ) : !isEditMode ? (
          /* ==================== MODE NORMAL: ULTRA-COMPACT CHECKLIST ==================== */
          <motion.div
            key="normal-list"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22 }}
            className="bg-white border border-slate-200/90 rounded-2xl divide-y divide-slate-100 overflow-hidden shadow-xs"
          >
            {items.map((item, index) => {
              const filled = isItemFilled(item);
              const isHighlighted = highlightedId === item.id;

              return (
                <div
                  key={item.id}
                  id={`item-row-${item.id}`}
                  className={`relative flex items-center justify-between gap-2 px-3 py-1.5 transition-colors duration-200 ${
                    isHighlighted
                      ? 'bg-blue-50'
                      : filled
                      ? 'bg-emerald-50/40'
                      : 'hover:bg-slate-50/70'
                  }`}
                >
                  {/* Left: Number + Item Name + Animated Checkmark */}
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span
                      className={`w-5 text-xs font-bold tabular-nums shrink-0 transition-colors ${
                        filled ? 'text-emerald-600' : 'text-slate-400'
                      }`}
                    >
                      {index + 1}.
                    </span>
                    <span
                      className={`text-sm font-bold truncate transition-colors ${
                        filled ? 'text-slate-900' : 'text-slate-700'
                      }`}
                    >
                      {item.name}
                    </span>
                    <AnimatePresence>
                      {filled && (
                        <motion.span
                          initial={{ scale: 0, rotate: -45 }}
                          animate={{ scale: 1, rotate: 0 }}
                          exit={{ scale: 0 }}
                          transition={{ type: 'spring', stiffness: 520, damping: 18 }}
                          className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-2xs"
                        >
                          <Check className="w-2.5 h-2.5 stroke-[3.5]" />
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Right: Compact Quantity Inputs */}
                  <div className="flex flex-wrap items-center justify-end gap-1.5 shrink-0">
                    {item.slots.map((slot, sIdx) => {
                      const hasVal = slot.v.trim() !== '';
                      return (
                        <React.Fragment key={sIdx}>
                          {sIdx > 0 && (
                            <span className="text-xs font-extrabold text-slate-300">+</span>
                          )}
                          <label
                            className={`inline-flex items-center h-8 rounded-xl border px-2.5 transition-all duration-150 ${
                              hasVal
                                ? 'bg-white border-emerald-500 ring-2 ring-emerald-500/15 shadow-2xs'
                                : 'bg-slate-50/90 border-slate-200/90 focus-within:bg-white focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600/15'
                            }`}
                          >
                            <input
                              type="text"
                              inputMode="decimal"
                              enterKeyHint="next"
                              data-slot-val="true"
                              value={slot.v}
                              onChange={(e) =>
                                handleValueChange(item.id, sIdx, e.target.value)
                              }
                              onKeyDown={handleValueKeyDown}
                              placeholder="0"
                              aria-label={`${item.name} kolom ${sIdx + 1}`}
                              className="w-11 sm:w-12 text-right text-sm font-extrabold text-slate-900 bg-transparent outline-none tabular-nums placeholder:text-slate-300"
                            />
                            {slot.u.trim() !== '' && (
                              <span className="ml-1.5 text-xs font-bold text-slate-400 select-none whitespace-nowrap">
                                {slot.u}
                              </span>
                            )}
                          </label>
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </motion.div>
        ) : (
          /* ==================== MODE EDIT: PREMIUM FLOATING CARDS + 120FPS HOLD-DRAG ==================== */
          <motion.div
            key="edit-list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            {/* Sleek Edit Studio Header Card */}
            <div className="mb-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-3.5 text-white shadow-md shadow-blue-600/15 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-blue-100">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Mode Pengaturan Barang</span>
                </div>
                <p className="text-xs text-white/90 mt-0.5 leading-relaxed">
                  <strong>Tahan & geser</strong> tombol nomor di kiri untuk ubah urutan, ketuk nama
                  untuk ubah nama, atau atur satuan di bawahnya.
                </p>
              </div>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.94 }}
                type="button"
                onClick={() => {
                  setNewName('');
                  setNewUnits(['pack']);
                  setShowAddModal(true);
                }}
                className="h-9 px-3.5 rounded-xl bg-white text-blue-700 font-extrabold text-xs flex items-center gap-1.5 shrink-0 shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[2.75]" />
                <span>Barang Baru</span>
              </motion.button>
            </div>

            {/* Floating Tactile Cards Container (120fps Direct DOM Drag) */}
            <div ref={editListRef} className="flex flex-col gap-2.5">
              {items.map((item, index) => {
                const isHighlighted = highlightedId === item.id;

                return (
                  <div
                    key={item.id}
                    id={`item-row-${item.id}`}
                    className={`edit-item-card group rounded-2xl bg-white border p-3 shadow-xs ${
                      isHighlighted ? 'border-blue-400 ring-2 ring-blue-400/20' : 'border-slate-200/90'
                    }`}
                  >
                    {/* Top Row: Hold-to-Drag Handle + Seamless Name Input + Delete Button */}
                    <div className="flex items-center gap-2.5">
                      {/* Tactile Hold-to-Drag Pill */}
                      <div
                        onPointerDown={handleGripPointerDown}
                        onPointerMove={handleGripPointerMove}
                        onPointerUp={finishDrag}
                        onPointerCancel={finishDrag}
                        onContextMenu={(e) => e.preventDefault()}
                        title="Tahan sebentar lalu geser ke atas/bawah"
                        className="grip-wiggle h-10 px-2.5 rounded-xl bg-slate-100 hover:bg-blue-50 active:bg-blue-600 active:text-white border border-slate-200/80 hover:border-blue-300 text-slate-600 hover:text-blue-700 flex items-center gap-1 select-none touch-none cursor-grab active:cursor-grabbing transition-colors shrink-0"
                      >
                        <GripVertical className="w-4 h-4 opacity-70" />
                        <span className="text-xs font-extrabold tabular-nums min-w-[18px] text-center">
                          {index + 1}
                        </span>
                      </div>

                      {/* Modern Seamless Editable Name Field */}
                      <div className="relative flex-1 min-w-0">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => handleNameChange(item.id, e.target.value)}
                          onBlur={(e) => handleNameBlur(item.id, e.target.value)}
                          placeholder="Nama barang..."
                          aria-label="Nama barang"
                          className="w-full h-10 pl-3 pr-8 rounded-xl bg-slate-50/80 hover:bg-slate-100/70 focus:bg-white border border-slate-200/80 focus:border-blue-500 focus:ring-3 focus:ring-blue-500/15 text-sm font-extrabold text-slate-900 outline-none transition-all"
                        />
                        <Pencil className="w-3.5 h-3.5 text-slate-400 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
                      </div>

                      {/* Sleek Coral Delete Button */}
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.9 }}
                        type="button"
                        onClick={() => handleDeleteItem(item, index)}
                        title="Hapus barang ini"
                        className="h-10 w-10 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200/70 text-rose-600 flex items-center justify-center shrink-0 cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </motion.button>
                    </div>

                    {/* Bottom Row: Interactive Unit Chips + "+ Satuan" Trigger */}
                    <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 mr-1">
                        <Layers className="w-3 h-3" />
                        <span>Satuan:</span>
                      </span>

                      {item.slots.map((slot, sIdx) => {
                        const hasUnit = slot.u.trim() !== '';
                        return (
                          <motion.div
                            layout
                            key={sIdx}
                            initial={{ scale: 0.85, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="inline-flex items-center h-7.5 rounded-xl bg-slate-100/90 hover:bg-slate-200/70 border border-slate-200/90 overflow-hidden transition-colors"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setCustomUnitText(slot.u);
                                setUnitPopup({
                                  itemId: item.id,
                                  itemName: item.name,
                                  mode: 'edit',
                                  slotIndex: sIdx,
                                  currentUnit: slot.u,
                                });
                              }}
                              title="Klik untuk ganti satuan"
                              className="h-full px-2.5 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
                            >
                              <span className="text-[10px] font-bold text-slate-400 tabular-nums">
                                #{sIdx + 1}
                              </span>
                              <span className={hasUnit ? 'text-slate-800' : 'text-slate-400 italic'}>
                                {hasUnit ? slot.u : 'Tanpa satuan'}
                              </span>
                            </button>

                            {item.slots.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveSlot(item.id, sIdx)}
                                title="Hapus kolom satuan ini"
                                className="h-full px-1.5 hover:bg-rose-100 text-slate-400 hover:text-rose-600 border-l border-slate-200/90 flex items-center justify-center cursor-pointer transition-colors"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </motion.div>
                        );
                      })}

                      {/* "+ Satuan" Button -> Opens Unit Popup Immediately */}
                      <motion.button
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.93 }}
                        type="button"
                        onClick={() => {
                          setCustomUnitText('');
                          setUnitPopup({
                            itemId: item.id,
                            itemName: item.name,
                            mode: 'add',
                          });
                        }}
                        className="h-7.5 px-3 rounded-xl bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white border border-blue-200 hover:border-blue-600 text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer transition-all shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[2.75]" />
                        <span>Tambah Satuan</span>
                      </motion.button>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </main>

      {/* Fixed Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-xl border-t border-slate-200/80 px-3.5 py-2.5">
        <div className="max-w-2xl mx-auto flex items-center gap-2">
          {isEditMode ? (
            <>
              <motion.button
                whileTap={{ scale: 0.97 }}
                type="button"
                onClick={() => {
                  setNewName('');
                  setNewUnits(['pack']);
                  setShowAddModal(true);
                }}
                className="flex-1 h-11 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[2.75]" />
                <span>Tambah Barang Baru</span>
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                type="button"
                onClick={() => setIsEditMode(false)}
                className="h-11 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-sm flex items-center justify-center gap-1.5 cursor-pointer shrink-0 shadow-sm"
              >
                <Check className="w-4 h-4 stroke-[2.75]" />
                <span>Selesai</span>
              </motion.button>
            </>
          ) : (
            <>
              <motion.button
                whileTap={{ scale: 0.95 }}
                type="button"
                onClick={() => setShowPreviewModal(true)}
                title="Lihat pratinjau pesan"
                className="h-11 px-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
              >
                <Eye className="w-4 h-4 text-slate-600" />
                <span className="hidden sm:inline">Pratinjau</span>
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                type="button"
                onClick={handleCopyReport}
                title="Salin teks laporan"
                className="h-11 px-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
              >
                <Copy className="w-4 h-4 text-slate-600" />
                <span>Salin</span>
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                type="button"
                onClick={handleSendWhatsApp}
                className="flex-1 h-11 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-md shadow-emerald-600/25 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Kirim ke WhatsApp</span>
                <span className="text-xs font-extrabold bg-black/15 px-2 py-0.5 rounded-lg tabular-nums">
                  {filledCount}/{totalCount}
                </span>
              </motion.button>
            </>
          )}
        </div>
      </div>

      {/* Animated Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 450, damping: 28 }}
            className="fixed bottom-18 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-3 text-xs sm:text-sm font-semibold max-w-[92vw]"
          >
            <span>{toast.message}</span>
            {toast.undoAction && (
              <button
                type="button"
                onClick={() => {
                  toast.undoAction?.();
                  setToast(null);
                }}
                className="text-blue-400 hover:text-blue-300 font-bold underline cursor-pointer shrink-0"
              >
                Urungkan
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* POP-UP PILIH SATUAN (pack, pcs, porsi, kg, gram) */}
      <AnimatePresence>
        {unitPopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setUnitPopup(null)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 backdrop-blur-xs p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.86, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 16 }}
              transition={{ type: 'spring', stiffness: 480, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white border border-slate-200 rounded-3xl w-full max-w-sm p-5 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-3.5">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">
                    {unitPopup.mode === 'add' ? 'Pilih Satuan Kolom Baru' : 'Ganti Satuan'}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Barang: <strong className="text-slate-800">{unitPopup.itemName}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setUnitPopup(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* 5 Main Units Requested: pack, pcs, porsi, kg, gram */}
              <div className="grid grid-cols-3 gap-2 mb-3.5">
                {PRIMARY_UNITS.map((u) => {
                  const isCurrent = unitPopup.mode === 'edit' && unitPopup.currentUnit === u;
                  return (
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.93 }}
                      key={u}
                      type="button"
                      onClick={() => handleSelectUnitFromPopup(u)}
                      className={`h-12 rounded-2xl border-2 font-extrabold text-sm flex items-center justify-center transition-all cursor-pointer shadow-2xs ${
                        isCurrent
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'border-blue-100 bg-blue-50/70 hover:bg-blue-600 hover:border-blue-600 hover:text-white text-blue-700'
                      }`}
                    >
                      {u}
                    </motion.button>
                  );
                })}
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.93 }}
                  type="button"
                  onClick={() => handleSelectUnitFromPopup('')}
                  className="h-12 rounded-2xl border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center transition-colors cursor-pointer"
                >
                  Tanpa Satuan
                </motion.button>
              </div>

              {/* Secondary Quick Units */}
              <div className="mb-3.5">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Satuan Lainnya
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {EXTRA_UNITS.map((u) => (
                    <motion.button
                      whileTap={{ scale: 0.93 }}
                      key={u}
                      type="button"
                      onClick={() => handleSelectUnitFromPopup(u)}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-900 hover:text-white text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                    >
                      {u}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Custom Unit Input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSelectUnitFromPopup(customUnitText.trim());
                }}
                className="flex items-center gap-2 pt-2.5 border-t border-slate-100"
              >
                <input
                  type="text"
                  maxLength={16}
                  value={customUnitText}
                  onChange={(e) => setCustomUnitText(e.target.value)}
                  placeholder="Atau ketik satuan sendiri..."
                  className="flex-1 h-9 px-3 rounded-xl border border-slate-300 text-xs font-semibold text-slate-900 focus:border-blue-600 outline-none"
                />
                <button
                  type="submit"
                  className="h-9 px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer shrink-0"
                >
                  Pakai
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal: Tambah Barang Baru */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowAddModal(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 backdrop-blur-xs p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.88, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 15 }}
              transition={{ type: 'spring', stiffness: 450, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-5 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <h2 className="text-base font-extrabold text-slate-900">Tambah Barang Baru</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateItem} className="space-y-4">
                <div>
                  <label
                    htmlFor="new-item-name"
                    className="block text-xs font-bold text-slate-700 mb-1"
                  >
                    Nama Barang
                  </label>
                  <input
                    id="new-item-name"
                    type="text"
                    autoFocus
                    required
                    maxLength={40}
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Contoh: Saos Tomat"
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm font-bold text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 outline-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      Pilih Satuan per Kolom
                    </label>
                    <button
                      type="button"
                      onClick={() => setNewUnits((prev) => [...prev, 'pcs'])}
                      className="text-xs font-bold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah Kolom</span>
                    </button>
                  </div>

                  <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                    {newUnits.map((selectedU, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-600">
                            Kolom Satuan #{idx + 1}
                          </span>
                          {newUnits.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                setNewUnits((prev) => prev.filter((_, i) => i !== idx))
                              }
                              className="text-xs font-bold text-rose-600 hover:underline flex items-center gap-0.5 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Hapus</span>
                            </button>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {[...PRIMARY_UNITS, 'btl', 'lembar', ''].map((unitOpt) => {
                            const active = selectedU === unitOpt;
                            return (
                              <button
                                key={unitOpt || 'none'}
                                type="button"
                                onClick={() =>
                                  setNewUnits((prev) =>
                                    prev.map((u, i) => (i === idx ? unitOpt : u))
                                  )
                                }
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                                  active
                                    ? 'bg-blue-600 border-blue-600 text-white shadow-2xs'
                                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                                }`}
                              >
                                {unitOpt || 'Tanpa Satuan'}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 h-10 rounded-xl border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="flex-1 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold cursor-pointer shadow-sm shadow-blue-600/20"
                  >
                    Simpan Barang
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal: Pratinjau Teks Laporan */}
      <AnimatePresence>
        {showPreviewModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowPreviewModal(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 backdrop-blur-xs p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 15 }}
              transition={{ type: 'spring', stiffness: 450, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-5 shadow-2xl flex flex-col max-h-[85dvh]"
            >
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-extrabold text-slate-900">Pratinjau Teks Laporan</h2>
                <button
                  type="button"
                  onClick={() => setShowPreviewModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <pre className="flex-1 overflow-y-auto bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs font-mono text-slate-800 whitespace-pre-wrap leading-relaxed">
                {buildReportMessage()}
              </pre>
              <div className="flex items-center gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setShowPreviewModal(false)}
                  className="flex-1 h-10 rounded-xl border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold cursor-pointer"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(buildReportMessage());
                      showToast('Teks berhasil disalin!');
                      setShowPreviewModal(false);
                    } catch {
                      // ignore
                    }
                  }}
                  className="flex-1 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Copy className="w-4 h-4" />
                  <span>Salin Teks</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal: Konfirmasi */}
      <AnimatePresence>
        {confirmDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setConfirmDialog(null)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 backdrop-blur-xs p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 15 }}
              transition={{ type: 'spring', stiffness: 450, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white border border-slate-200 rounded-3xl w-full max-w-sm p-5 shadow-2xl"
            >
              <div className="flex items-start gap-3 mb-3">
                <AlertCircle
                  className={`w-5 h-5 shrink-0 mt-0.5 ${
                    confirmDialog.danger ? 'text-rose-600' : 'text-amber-600'
                  }`}
                />
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">
                    {confirmDialog.title}
                  </h2>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {confirmDialog.message}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setConfirmDialog(null)}
                  className="flex-1 h-10 rounded-xl border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-bold cursor-pointer"
                >
                  {confirmDialog.cancelLabel}
                </button>
                <button
                  type="button"
                  onClick={confirmDialog.onConfirm}
                  className={`flex-1 h-10 rounded-xl text-white text-xs sm:text-sm font-bold cursor-pointer ${
                    confirmDialog.danger
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {confirmDialog.confirmLabel}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
