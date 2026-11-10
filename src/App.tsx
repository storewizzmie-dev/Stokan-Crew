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
  Calendar,
  Layers,
  MoreVertical,
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

const LS_KEY = 'sisa-fisik:v2';

const ALLOWED_UNITS = ['Pack', 'Porsi', 'Pcs', 'Kg', 'Gram', 'Botol'] as const;

const normalizeUnit = (u: string): string => {
  const clean = u.trim().toLowerCase();
  if (!clean) return '';
  if (clean === 'pack' || clean === 'pak') return 'Pack';
  if (clean === 'porsi') return 'Porsi';
  if (clean === 'pcs' || clean === 'lembar' || clean === 'buah') return 'Pcs';
  if (clean === 'kg' || clean === 'kilo') return 'Kg';
  if (clean === 'gram' || clean === 'gr' || clean === 'g') return 'Gram';
  if (clean === 'botol' || clean === 'btl') return 'Botol';
  return 'Pcs';
};

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const mk = (name: string, ...units: string[]): Item => ({
  id: uid(),
  name,
  slots: units.slice(0, 2).map((u) => ({ v: '', u: normalizeUnit(u) })),
});

const getDefaultItems = (): Item[] => [
  mk('Karage', 'Pack'),
  mk('Sayap', 'Pack', 'Porsi'),
  mk('Ayam filet', 'Porsi'),
  mk('Ayam kecil', 'Pack', 'Porsi'),
  mk('Ayam besar', 'Pack', 'Porsi'),
  mk('Ebi', 'Pcs'),
  mk('Timun', 'Pcs'),
  mk('Crabstik', 'Pack'),
  mk('Koslow', 'Porsi'),
  mk('Selada', 'Kg'),
  mk('Saos Black paper', 'Pack'),
  mk('Saos teriyaki', 'Pack'),
  mk('Saos Asam manis', 'Botol'),
  mk('Saos pedas', 'Pack'),
  mk('Cuka', 'Botol'),
  mk('Kwipie', 'Pack'),
  mk('Mestro', 'Pack'),
  mk('Mentai', 'Pack'),
  mk('Wijen', 'Pack'),
  mk('Minyak', 'Pack'),
  mk('Tobiko', 'Pack'),
  mk('Ricepaper', 'Pcs'),
  mk('Mika', 'Pcs'),
  mk('Cup(35)', 'Pcs'),
  mk('Sambal horeg', 'Porsi'),
  mk('Nasi', 'Kg', 'Porsi'),
  mk('Nori', 'Pack', 'Pcs'),
  mk('Klip besar', 'Pack', 'Pcs'),
  mk('Klip sedang', 'Pack', 'Pcs'),
  mk('Klip kecil', 'Pcs'),
  mk('Tepung wfc', 'Pack'),
];

const toDateInputValue = (d = new Date()) => {
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  );
};

const formatDateId = (yyyyMmDd: string) => {
  if (!yyyyMmDd) return '';
  const [y, m, d] = yyyyMmDd.split('-').map(Number);
  const dateObj = new Date(y, (m || 1) - 1, d || 1);
  return dateObj.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

const isItemFilled = (item: Item) => item.slots.some((s) => s.v.trim() !== '');

export default function App() {
  const [items, setItems] = useState<Item[]>(() => {
    try {
      const raw = localStorage.getItem(LS_KEY) || localStorage.getItem('sisa-fisik:v1');
      if (!raw) return getDefaultItems();
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.items)) return getDefaultItems();
      const loadedItems: Item[] = parsed.items
        .filter((i: unknown) => i && typeof i === 'object')
        .map((i: Record<string, unknown>) => ({
          id: String(i.id || uid()),
          name: String(i.name || 'Barang'),
          slots: (Array.isArray(i.slots) && i.slots.length ? i.slots : [{ v: '', u: 'Pack' }])
            .slice(0, 2)
            .map((s: Record<string, unknown>) => ({
              v: String((s && s.v) || ''),
              u: normalizeUnit(String((s && s.u) || 'Pack')),
            })),
        }));

      const currentDay = toDateInputValue();
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

  // Per-Item 3-dots menu & Per-Item Edit state
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // Unit Picker Popup State
  const [unitPopup, setUnitPopup] = useState<{
    itemId: string;
    itemName: string;
    mode: 'add' | 'edit';
    slotIndex?: number;
    currentUnit?: string;
  } | null>(null);

  // Add New Item Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUnits, setNewUnits] = useState<string[]>(['Pack']);

  // Date Picker Popup before sending to WhatsApp
  const [showDateModal, setShowDateModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(() => toDateInputValue());

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
  const listRef = useRef<HTMLDivElement>(null);
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

  // Close 3-dots menu when clicking outside
  useEffect(() => {
    if (!openMenuId) return;
    const handleOutsideClick = () => setOpenMenuId(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [openMenuId]);

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        LS_KEY,
        JSON.stringify({
          items,
          theme: 'light',
          day: toDateInputValue(),
        })
      );
    } catch {
      // ignore storage quota errors
    }
  }, [items]);

  const totalCount = items.length;
  const filledCount = useMemo(() => items.filter(isItemFilled).length, [items]);
  const progressPercent = totalCount > 0 ? Math.round((filledCount / totalCount) * 100) : 0;

  // Fill values
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

  // Edit Item Name & Slots (Max 2 slots)
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
          if (it.slots.length >= 2) return it;
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
    if (editingItemId === item.id) setEditingItemId(null);
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

    const cleanUnits = (newUnits.length > 0 ? newUnits : ['Pack']).slice(0, 2);
    const newItem: Item = {
      id: uid(),
      name: trimmedName,
      slots: cleanUnits.map((u) => ({ v: '', u })),
    };

    setItems((prev) => [...prev, newItem]);
    setShowAddModal(false);
    setNewName('');
    setNewUnits(['Pack']);
    setHighlightedId(newItem.id);
    showToast(`"${trimmedName}" berhasil ditambahkan`);

    setTimeout(() => {
      const row = document.getElementById(`item-row-${newItem.id}`);
      row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 120);
    setTimeout(() => setHighlightedId(null), 2200);
  };

  /* ============================================================================
   * 120FPS ZERO-DELAY HOLD & DRAG ENGINE (Works directly on the edited item!)
   * ============================================================================ */
  const updateDragPosition = () => {
    const d = dragRef.current;
    if (!d || !d.active) return;

    const last = d.els.length - 1;
    const rawDy = d.clientY - d.startY + (window.scrollY - d.startScroll);
    const minDy = d.tops[0] - d.tops[d.from];
    const maxDy = d.tops[last] + d.hs[last] - (d.tops[d.from] + d.hs[d.from]);
    const dy = Math.max(minDy, Math.min(maxDy, rawDy));

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
    const cardEl = grip.closest('.list-row-item') as HTMLElement | null;
    const listEl = listRef.current;
    if (!cardEl || !listEl) return;

    const startY = e.clientY;
    const pid = e.pointerId;

    cardEl.classList.add('is-holding');

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
      let gap = 0;
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
    if (!dragRef.current) return;
    e.preventDefault();
    dragRef.current.clientY = e.clientY;
    updateDragPosition();
  };

  const finishDrag = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    const listEl = listRef.current;
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

  // Clear all values: ALWAYS shows confirmation pop-up
  const handleClearValues = () => {
    setConfirmDialog({
      title: 'Apakah anda yakin hapus data angka yang terisi?',
      message:
        'Semua angka stok yang sudah diisi akan dikosongkan kembali menjadi 0. Daftar nama barang dan satuan tetap aman tersimpan.',
      confirmLabel: 'Ya, Hapus',
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
        showToast('Data angka berhasil dihapus');
      },
    });
  };

  // Format report: "Sayap = 5 Pack + 2 Porsi"
  const formatItemLine = (it: Item) => {
    const parts = it.slots
      .filter((s) => s.v.trim() !== '')
      .map((s) => s.v.trim() + (s.u.trim() ? ' ' + s.u.trim() : ''));
    return `${it.name.trim() || 'Barang'} = ${parts.length ? parts.join(' + ') : '-'}`;
  };

  const buildReportMessage = (dateStr = selectedDate) => {
    const head = `*Sisa Fisik* – ${formatDateId(dateStr)}`;
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

  const handleClickSendDock = () => {
    if (items.length === 0) {
      showToast('Daftar barang masih kosong');
      return;
    }
    setSelectedDate(toDateInputValue());
    setShowDateModal(true);
  };

  const handleConfirmSendFromDatePopup = () => {
    const msg = buildReportMessage(selectedDate);
    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    try {
      navigator.clipboard.writeText(msg);
    } catch {
      // ignore
    }
    setShowDateModal(false);
    launchConfetti();

    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleCopyReport = async () => {
    const msg = buildReportMessage(selectedDate);
    try {
      await navigator.clipboard.writeText(msg);
      showToast('Teks laporan berhasil disalin!');
    } catch {
      setShowPreviewModal(true);
    }
  };

  return (
    <div className="min-h-dvh bg-[#f4f6fb] text-slate-900 pt-[76px] pb-26">
      {/* FIXED Top Header: Never moves or shifts when scrolling */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-white border-b border-slate-200 shadow-2xs">
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
                  initial={{ scale: 1.25, color: '#2563eb' }}
                  animate={{ scale: 1, color: '#475569' }}
                  transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                  className="text-xs font-extrabold text-slate-600 tabular-nums shrink-0"
                >
                  {filledCount}/{totalCount} terisi
                </motion.span>
              </div>
              <p className="text-xs font-semibold text-slate-500 truncate">
                {formatDateId(toDateInputValue())}
              </p>
            </div>

            {/* Right Controls: Reset & Tambah Barang */}
            <div className="flex items-center gap-3 shrink-0">
              <motion.button
                whileTap={{ scale: 0.92 }}
                type="button"
                onClick={handleClearValues}
                title="Kosongkan angka"
                className="h-9 px-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.92 }}
                type="button"
                onClick={() => {
                  setNewName('');
                  setNewUnits(['Pack']);
                  setShowAddModal(true);
                }}
                className="h-9 px-3.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-all cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.75]" />
                <span>Barang</span>
              </motion.button>
            </div>
          </div>

          {/* Animated Progress Bar */}
          <div className="mt-2 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ type: 'spring', stiffness: 140, damping: 22 }}
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-2.5 sm:px-3.5 pt-2.5">
        {items.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-slate-200 rounded-2xl p-8 text-center my-4 shadow-2xs"
          >
            <p className="text-base font-bold text-slate-800 mb-1">Daftar barang masih kosong</p>
            <p className="text-xs text-slate-500 mb-4">
              Klik tombol di bawah untuk mulai menambahkan barang stok.
            </p>
            <motion.button
              whileTap={{ scale: 0.95 }}
              type="button"
              onClick={() => {
                setNewName('');
                setNewUnits(['Pack']);
                setShowAddModal(true);
              }}
              className="px-4 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Barang Sekarang</span>
            </motion.button>
          </motion.div>
        ) : (
          <div
            ref={listRef}
            className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 shadow-xs"
          >
            {items.map((item, index) => {
              const filled = isItemFilled(item);
              const isHighlighted = highlightedId === item.id;
              const isEditingThis = editingItemId === item.id;
              const isMenuOpen = openMenuId === item.id;
              const openUpwards = index >= items.length - 2 && items.length > 3;

              /* ==================== SINGLE ITEM EDIT VIEW ==================== */
              if (isEditingThis) {
                return (
                  <div
                    key={item.id}
                    id={`item-row-${item.id}`}
                    className="list-row-item bg-blue-50/50 p-3 ring-2 ring-blue-500/80 rounded-xl z-20"
                  >
                    {/* Top Row: Hold-to-Drag Handle + Editable Name + Delete + Selesai */}
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <div
                        onPointerDown={handleGripPointerDown}
                        onPointerMove={handleGripPointerMove}
                        onPointerUp={finishDrag}
                        onPointerCancel={finishDrag}
                        onContextMenu={(e) => e.preventDefault()}
                        title="Tahan sebentar lalu geser ke atas/bawah untuk ubah urutan"
                        className="h-9 px-2 rounded-xl bg-white hover:bg-blue-50 active:bg-blue-600 active:text-white border-2 border-blue-200 text-slate-800 flex items-center gap-1 select-none touch-none cursor-grab active:cursor-grabbing transition-colors shrink-0 shadow-2xs"
                      >
                        <GripVertical className="w-3.5 h-3.5 text-blue-600" />
                        <span className="text-xs font-extrabold tabular-nums min-w-[16px] text-center">
                          {index + 1}
                        </span>
                      </div>

                      <input
                        type="text"
                        autoFocus
                        value={item.name}
                        onChange={(e) => handleNameChange(item.id, e.target.value)}
                        onBlur={(e) => handleNameBlur(item.id, e.target.value)}
                        placeholder="Nama barang..."
                        aria-label="Nama barang"
                        className="flex-1 min-w-0 h-9 px-2.5 rounded-xl bg-white border-2 border-blue-400 focus:border-blue-600 text-sm font-extrabold text-slate-900 outline-none shadow-2xs"
                      />

                      <button
                        type="button"
                        onClick={() => handleDeleteItem(item, index)}
                        title="Hapus barang ini"
                        className="h-9 w-9 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0 cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setEditingItemId(null)}
                        className="h-9 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold flex items-center gap-1 shrink-0 cursor-pointer shadow-xs"
                      >
                        <Check className="w-3.5 h-3.5 stroke-[2.75]" />
                        <span>Selesai</span>
                      </button>
                    </div>

                    {/* Bottom Row: Unit Columns (Max 2) + Hold Hint */}
                    <div className="mt-2.5 pt-2 border-t border-blue-200/60 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-600">
                          <Layers className="w-3.5 h-3.5 text-blue-600" />
                          <span>Satuan:</span>
                        </span>

                        {item.slots.map((slot, sIdx) => (
                          <div
                            key={sIdx}
                            className="inline-flex items-center h-7.5 rounded-lg bg-white border border-slate-300 overflow-hidden shadow-2xs"
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setUnitPopup({
                                  itemId: item.id,
                                  itemName: item.name,
                                  mode: 'edit',
                                  slotIndex: sIdx,
                                  currentUnit: slot.u,
                                })
                              }
                              title="Klik untuk ganti satuan"
                              className="h-full px-2.5 text-xs font-extrabold text-slate-800 flex items-center gap-1 cursor-pointer hover:bg-slate-50"
                            >
                              <span className="text-[10px] font-bold text-slate-400 tabular-nums">
                                #{sIdx + 1}
                              </span>
                              <span className="text-blue-700 font-extrabold text-xs">
                                {slot.u || 'Pilih'}
                              </span>
                            </button>

                            {item.slots.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveSlot(item.id, sIdx)}
                                title="Hapus kolom satuan ini"
                                className="h-full px-1.5 hover:bg-rose-100 text-slate-400 hover:text-rose-600 border-l border-slate-200 flex items-center justify-center cursor-pointer transition-colors"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))}

                        {item.slots.length < 2 && (
                          <button
                            type="button"
                            onClick={() =>
                              setUnitPopup({
                                itemId: item.id,
                                itemName: item.name,
                                mode: 'add',
                              })
                            }
                            className="h-7.5 px-2.5 rounded-lg bg-white hover:bg-blue-600 text-blue-700 hover:text-white border border-blue-300 hover:border-blue-600 text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer transition-all shadow-2xs"
                          >
                            <Plus className="w-3 h-3 stroke-[2.75]" />
                            <span>Tambah Satuan</span>
                          </button>
                        )}
                      </div>

                      <span className="text-[11px] font-semibold text-blue-700">
                        Tahan nomor di kiri untuk geser posisi
                      </span>
                    </div>
                  </div>
                );
              }

              /* ==================== NORMAL ROW VIEW ==================== */
              return (
                <div
                  key={item.id}
                  id={`item-row-${item.id}`}
                  className={`list-row-item flex items-center justify-between gap-1.5 sm:gap-2 px-2.5 py-2 sm:px-3.5 sm:py-2.5 transition-colors duration-150 ${
                    isMenuOpen ? 'menu-open z-35' : ''
                  } ${
                    isHighlighted
                      ? 'bg-blue-50'
                      : filled
                      ? 'bg-blue-50/15'
                      : 'hover:bg-slate-50/70'
                  }`}
                >
                  {/* Left: Number Box (Blue Fill + Blue Border & Black Text when filled) + Item Name */}
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span
                      className={`w-6 h-6 sm:w-6.5 sm:h-6.5 rounded-md text-xs font-extrabold tabular-nums flex items-center justify-center shrink-0 transition-all duration-200 text-slate-950 ${
                        filled
                          ? 'border-2 border-blue-600 bg-blue-300 shadow-2xs'
                          : 'border border-slate-300 bg-slate-100'
                      }`}
                    >
                      {index + 1}
                    </span>
                    <span className="text-[13.5px] sm:text-sm font-bold text-slate-900 leading-tight truncate">
                      {item.name}
                    </span>
                  </div>

                  {/* Right: Borderless Quantity Inputs (Wide touch reach, compact width) + 3-Dots Button */}
                  <div className="flex items-center justify-end gap-0.5 sm:gap-1.5 shrink-0">
                    <div className="flex items-center justify-end gap-1 sm:gap-2">
                      {item.slots.map((slot, sIdx) => {
                        const hasVal = slot.v.trim() !== '';
                        const isTwoSlots = item.slots.length > 1;
                        return (
                          <React.Fragment key={sIdx}>
                            {sIdx > 0 && (
                              <span className="text-xs font-extrabold text-slate-300 select-none">
                                +
                              </span>
                            )}
                            <label
                              className={`inline-flex items-center justify-between h-9 px-1.5 rounded-lg cursor-text transition-colors ${
                                isTwoSlots
                                  ? 'w-[72px] sm:w-24'
                                  : 'w-[104px] sm:w-32'
                              } ${
                                hasVal
                                  ? 'bg-blue-50/60'
                                  : 'hover:bg-slate-100/70 focus-within:bg-blue-50/60'
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
                                className="flex-1 min-w-0 w-full text-center text-[14px] sm:text-[15px] font-extrabold text-slate-900 bg-transparent border-0 outline-none tabular-nums placeholder:text-slate-300"
                              />
                              {slot.u.trim() !== '' && (
                                <span
                                  className={`ml-1 text-[11.5px] sm:text-xs font-extrabold select-none whitespace-nowrap shrink-0 ${
                                    hasVal ? 'text-blue-700' : 'text-slate-500'
                                  }`}
                                >
                                  {slot.u}
                                </span>
                              )}
                            </label>
                          </React.Fragment>
                        );
                      })}
                    </div>

                    {/* 3-Dots Menu Trigger at Far Right */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId((prev) => (prev === item.id ? null : item.id));
                        }}
                        aria-label="Menu opsi barang"
                        className={`w-7 h-8 sm:w-7.5 sm:h-8.5 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                          isMenuOpen
                            ? 'bg-blue-100 text-blue-700'
                            : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {/* Floating Popover when 3-dots clicked (Always on top!) */}
                      <AnimatePresence>
                        {isMenuOpen && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.92, y: openUpwards ? 4 : -4 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.92, y: openUpwards ? 4 : -4 }}
                            transition={{ duration: 0.14 }}
                            onClick={(e) => e.stopPropagation()}
                            className={`absolute right-0 ${
                              openUpwards ? 'bottom-9' : 'top-9'
                            } z-50 w-36 bg-white border border-slate-200 rounded-xl shadow-2xl py-1 overflow-hidden`}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuId(null);
                                setEditingItemId(item.id);
                              }}
                              className="w-full px-3.5 py-2.5 text-left text-xs font-extrabold text-slate-800 hover:bg-blue-50 hover:text-blue-700 active:bg-blue-100 flex items-center gap-2 cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5 text-blue-600" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuId(null);
                                handleDeleteItem(item, index);
                              }}
                              className="w-full px-3.5 py-2.5 text-left text-xs font-extrabold text-rose-600 hover:bg-rose-50 active:bg-rose-100 flex items-center gap-2 border-t border-slate-100 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Hapus</span>
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Fixed Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-xl border-t border-slate-200/80 px-3.5 py-2.5">
        <div className="max-w-2xl mx-auto flex items-center gap-2">
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
            onClick={handleClickSendDock}
            className="flex-1 h-11 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-md shadow-emerald-600/25 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>Kirim ke WhatsApp</span>
            <span className="text-xs font-extrabold bg-black/15 px-2 py-0.5 rounded-lg tabular-nums">
              {filledCount}/{totalCount}
            </span>
          </motion.button>
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

      {/* POP-UP PILIH SATUAN (Strictly: Pack, Porsi, Pcs, Kg, Gram, Botol) */}
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
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">
                    {unitPopup.mode === 'add' ? 'Pilih Satuan Kolom ke-2' : 'Pilih Satuan'}
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

              <div className="grid grid-cols-2 gap-2.5">
                {ALLOWED_UNITS.map((u) => {
                  const isCurrent = unitPopup.mode === 'edit' && unitPopup.currentUnit === u;
                  return (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.94 }}
                      key={u}
                      type="button"
                      onClick={() => handleSelectUnitFromPopup(u)}
                      className={`h-12 rounded-2xl border-2 font-extrabold text-sm flex items-center justify-center transition-all cursor-pointer shadow-2xs ${
                        isCurrent
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'border-slate-200 bg-slate-50 hover:bg-blue-600 hover:border-blue-600 hover:text-white text-slate-800'
                      }`}
                    >
                      {u}
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* POP-UP PILIH TANGGAL SEBELUM KIRIM KE WHATSAPP */}
      <AnimatePresence>
        {showDateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowDateModal(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 backdrop-blur-xs p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.88, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 15 }}
              transition={{ type: 'spring', stiffness: 450, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white border border-slate-200 rounded-3xl w-full max-w-sm p-5 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900">
                      Pilih Tanggal Laporan
                    </h2>
                    <p className="text-xs text-slate-500">
                      {filledCount} dari {totalCount} barang telah diisi
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDateModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setSelectedDate(toDateInputValue(new Date()))}
                  className={`flex-1 h-9 rounded-xl text-xs font-extrabold border transition-colors cursor-pointer ${
                    selectedDate === toDateInputValue(new Date())
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Hari Ini
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const yest = new Date();
                    yest.setDate(yest.getDate() - 1);
                    setSelectedDate(toDateInputValue(yest));
                  }}
                  className={`flex-1 h-9 rounded-xl text-xs font-extrabold border transition-colors cursor-pointer ${
                    (() => {
                      const yest = new Date();
                      yest.setDate(yest.getDate() - 1);
                      return selectedDate === toDateInputValue(yest);
                    })()
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Kemarin
                </button>
              </div>

              <div className="mb-3">
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Atau Pilih Tanggal Kalender:
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white text-sm font-extrabold text-slate-900 focus:border-emerald-600 outline-none"
                />
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 mb-4">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Format Header Pesan:
                </div>
                <div className="text-xs font-extrabold text-slate-800 mt-0.5">
                  *Sisa Fisik* – {formatDateId(selectedDate)}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowDateModal(false)}
                  className="h-11 px-4 rounded-xl border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-bold cursor-pointer"
                >
                  Batal
                </button>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  type="button"
                  onClick={handleConfirmSendFromDatePopup}
                  className="flex-1 h-11 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-md shadow-emerald-600/25 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>Kirim ke WhatsApp</span>
                </motion.button>
              </div>
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
                <h2 className="text-base font-extrabold text-slate-900">Tambah Barang Baru</h2>
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
                      Pilih Satuan (Maksimal 2 Kolom)
                    </label>
                    {newUnits.length < 2 && (
                      <button
                        type="button"
                        onClick={() => setNewUnits((prev) => [...prev, 'Porsi'])}
                        className="text-xs font-extrabold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Tambah Kolom ke-2</span>
                      </button>
                    )}
                  </div>

                  <div className="space-y-2.5">
                    {newUnits.map((selectedU, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold text-slate-700">
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
                        <div className="grid grid-cols-3 gap-1.5">
                          {ALLOWED_UNITS.map((unitOpt) => {
                            const active = selectedU === unitOpt;
                            return (
                              <button
                                key={unitOpt}
                                type="button"
                                onClick={() =>
                                  setNewUnits((prev) =>
                                    prev.map((u, i) => (i === idx ? unitOpt : u))
                                  )
                                }
                                className={`h-9 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                                  active
                                    ? 'bg-blue-600 border-blue-600 text-white shadow-2xs'
                                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                                }`}
                              >
                                {unitOpt}
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
              <pre className="flex-1 overflow-y-auto bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs font-mono text-slate-800 whitespace-pre-wrap leading-relaxed">
                {buildReportMessage(selectedDate)}
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
                      await navigator.clipboard.writeText(buildReportMessage(selectedDate));
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

      {/* Modal: Konfirmasi Reset */}
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
                  <h2 className="text-base font-extrabold text-slate-900 leading-snug">
                    {confirmDialog.title}
                  </h2>
                  <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
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
