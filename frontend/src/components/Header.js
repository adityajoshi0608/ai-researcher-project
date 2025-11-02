// src/components/Header.js
"use client";

import { Menu } from 'lucide-react';

export default function Header({ setIsOpen }) {
  return (
    // A clean, simple header that's slightly transparent
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between 
      border-b border-neutral-800 
      bg-neutral-950/80 backdrop-blur-md 
      px-4 lg:hidden"
    >
      <span className="font-semibold text-lg text-white">AI Researcher</span>
      <button
        onClick={() => setIsOpen(true)}
        className="p-2 text-neutral-300 hover:text-white"
      >
        <Menu className="h-6 w-6" />
      </button>
    </header>
  );
}