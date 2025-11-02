// src/components/ChatInput.js
"use client";

import { useState } from 'react';
import { Send, Loader2, Paperclip } from 'lucide-react';
import UploaderModal from './UploaderModal'; // We will create this file next

export default function ChatInput({ query, setQuery, isLoading, handleResearch, userId }) {
  
  // State to control the new uploader modal
  const [uploaderOpen, setUploaderOpen] = useState(false);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !isLoading && query) {
      e.preventDefault();
      handleResearch();
    }
  };

  return (
    <>
      {/* The Uploader Modal is now separate and clean */}
      <UploaderModal 
        isOpen={uploaderOpen} 
        setIsOpen={setUploaderOpen} 
        userId={userId} 
      />

      <footer className="sticky bottom-0 z-10 bg-neutral-950/80 backdrop-blur-md border-t border-neutral-800 p-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-3 p-2 bg-neutral-900 border border-neutral-700 rounded-xl shadow-lg">
            
            {/* Attach File Button */}
            <button
              onClick={() => setUploaderOpen(true)}
              className="flex-shrink-0 p-3 rounded-lg h-12 w-12 flex items-center justify-center 
              text-neutral-400 hover:text-white
              hover:bg-neutral-800 transition-colors"
              title="Upload Documents"
            >
              <Paperclip className="w-5 h-5" />
            </button>

            {/* Text Input Area */}
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask your AI Researcher anything..."
              className="flex-grow p-3 bg-transparent text-white placeholder-neutral-400 
              focus:outline-none resize-none max-h-40"
              rows={1}
              disabled={isLoading}
              style={{
                // Auto-grows the textarea
                height: 'auto',
                minHeight: '48px',
                height: `${Math.min(4, query.split('\n').length) * 24 + 24}px`
              }}
            />
            
            {/* Send Button */}
            <button
              onClick={handleResearch}
              disabled={isLoading || !query}
              className="flex-shrink-0 p-3 rounded-lg h-12 w-12 flex items-center justify-center text-white 
              bg-blue-600 hover:bg-blue-500
              disabled:bg-neutral-700 disabled:cursor-not-allowed
              transition-colors"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </footer>
    </>
  );
}