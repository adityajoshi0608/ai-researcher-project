// src/components/Sidebar.js
"use client";

import { LogOut, Plus, Loader2, MessageSquare, Trash2 } from 'lucide-react';
import { Fragment } from 'react';

export default function Sidebar({
  session,
  history,
  loadConversation,
  handleLogout,
  startNewChat,
  isLoadingHistory,
  isLoadingConversation,
  handleDeleteConversation,
  isOpen,
  setIsOpen,
  isDesktop = false
}) {

  const activeConversationId = null;

  const sidebarContent = (
    <div className="flex flex-col h-full bg-neutral-900 border-r border-neutral-800">
      
      {/* Header */}
      <div className="p-4 border-b border-neutral-800">
        <h2 className="text-xl font-bold text-white">AI Researcher</h2>
      </div>

      {/* New Chat Button */}
      <div className="p-4">
        <button
          onClick={startNewChat}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg transition-all text-sm 
          bg-blue-600 hover:bg-blue-700 text-white font-semibold 
          border border-blue-600 hover:border-blue-500
          shadow-lg shadow-blue-900/50"
        >
          <Plus className="w-5 h-5" />
          New Research
        </button>
      </div>

      {/* History */}
      <div className="flex-grow overflow-y-auto custom-scrollbar p-4 space-y-2">
        <h3 className="text-xs font-semibold uppercase text-neutral-500 mb-2">History</h3>
        {isLoadingHistory ? (
          <div className="flex justify-center items-center p-4">
            <Loader2 className="w-5 h-5 text-neutral-400 animate-spin" />
          </div>
        ) : history.length === 0 ? (
          <p className="text-neutral-500 text-sm italic p-2">No conversations yet.</p>
        ) : (
          history.map((conv) => (
            <div
              key={conv.id}
              className={`
                group flex items-center justify-between w-full rounded-lg
                text-sm text-neutral-300
                ${conv.id === activeConversationId
                  ? 'bg-neutral-700'
                  : 'hover:bg-neutral-800'
                }
              `}
            >
              {/* Load Conversation Button */}
              <button
                onClick={() => loadConversation(conv.id)}
                title={conv.query_text}
                disabled={isLoadingConversation}
                className="flex items-center gap-3 px-3 py-2.5 truncate flex-grow disabled:opacity-50"
              >
                <MessageSquare className="w-4 h-4 flex-shrink-0 text-neutral-500" />
                <span className="truncate">{conv.query_text}</span>
              </button>

              {/* Delete Conversation Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteConversation(conv.id);
                }}
                disabled={isLoadingConversation}
                title="Delete chat"
                className="
                  flex-shrink-0 p-2 text-neutral-500 hover:text-red-400
                  opacity-0 group-hover:opacity-100 transition-opacity
                  disabled:opacity-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* User Info & Logout Button */}
      <div className="p-4 border-t border-neutral-800">
        <p className="text-xs text-neutral-400 mb-2 truncate" title={session.user.email}>
          {session.user.email}
        </p> 
        {/* ^^^ THIS WAS THE LINE WITH THE ERROR. It's now fixed. */}
        
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 
          bg-neutral-800 hover:bg-neutral-700 
          border border-neutral-700
          rounded-lg text-sm font-medium text-neutral-300 hover:text-white transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </div>
  );

  if (isDesktop) {
    return (
      <div className="w-72 h-full flex-shrink-0">
        {sidebarContent}
      </div>
    );
  }

  // Mobile implementation
  return (
    <Fragment>
      <div
        onClick={() => setIsOpen(false)}
        className={`fixed inset-0 bg-black/70 z-30 backdrop-blur-sm transition-opacity lg:hidden
          ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}
        `}
      />
      <div
        className={`fixed inset-y-0 left-0 w-72 z-40 transition-transform transform lg:hidden
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {sidebarContent}
      </div>
    </Fragment>
  );
}