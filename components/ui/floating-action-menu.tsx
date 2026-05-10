'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type FloatingActionOption = {
  label: string;
  Icon: React.ReactNode;
  onClick?: () => void;
};

type FloatingActionMenuProps = {
  options: FloatingActionOption[];
  className?: string;
};

export default function FloatingActionMenu({ options, className = '' }: FloatingActionMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`flex flex-col items-end gap-3 ${className}`}>
      <AnimatePresence>
        {open && options.map((option, index) => (
          <motion.button
            key={option.label}
            type="button"
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.15, delay: index * 0.04 }}
            onClick={() => {
              option.onClick?.();
              setOpen(false);
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/70 px-3 py-2 text-xs text-white backdrop-blur-md hover:bg-white/10"
          >
            <span className="text-gray-200">{option.Icon}</span>
            <span>{option.label}</span>
          </motion.button>
        ))}
      </AnimatePresence>

      <button
        type="button"
        aria-label="Toggle floating action menu"
        onClick={() => setOpen((prev) => !prev)}
        className="h-12 w-12 rounded-full border border-[#007AFF]/40 bg-[#007AFF]/20 text-white shadow-[0_0_20px_rgba(0,122,255,0.35)] transition hover:bg-[#007AFF]/35"
      >
        {open ? 'x' : '+'}
      </button>
    </div>
  );
}
