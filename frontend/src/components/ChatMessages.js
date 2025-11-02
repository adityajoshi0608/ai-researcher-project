// src/components/ChatMessages.js
"use client";

// --- MODIFIED: Added useState ---
import { useState } from 'react'; 
import ReactMarkdown from 'react-markdown';
// --- MODIFIED: Added Clipboard and Check icons ---
import { Loader2, User, Brain, Bot, Clipboard, Check } from 'lucide-react';

// Welcome screen component (Unchanged)
const WelcomeScreen = ({ session }) => (
  <div className="flex flex-col items-center justify-center h-full text-center p-4">
    <div className="p-4 bg-blue-600/20 rounded-full mb-6 border border-blue-500/30">
      <Brain className="w-16 h-16 text-blue-400" />
    </div>
    <h2 className="text-3xl font-extrabold text-white mb-2">
      Hello, {session.user.email?.split('@')[0] || 'Researcher'}!
    </h2>
    <p className="text-neutral-400 text-lg max-w-md">
      Start a new research session or upload a document with the paperclip icon below.
    </p>
  </div>
);

// Loading spinner for conversation history (Unchanged)
const ConversationLoader = () => (
  <div className="flex flex-col items-center justify-center h-full text-center p-4">
    <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
    <p className="text-neutral-400 text-lg mt-4">Loading conversation...</p>
  </div>
);

// --- MODIFIED: Renders a single message with a copy button ---
const Message = ({ msg, isStreaming }) => {
  const isUser = msg.role === 'user';
  
  // --- NEW: State to manage copy success ---
  const [isCopied, setIsCopied] = useState(false);

  // --- NEW: Function to copy text to clipboard ---
  const handleCopy = () => {
    if (isStreaming || !msg.content) return; // Don't copy while streaming or if empty

    navigator.clipboard.writeText(msg.content).then(() => {
      setIsCopied(true);
      // Reset the "Copied!" message after 2 seconds
      setTimeout(() => setIsCopied(false), 2000);
    }).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  };

  return (
    <div className="flex gap-4 w-full">
      {/* Avatar */}
      <div className={`
        flex-shrink-0 w-8 h-8 rounded-full 
        flex items-center justify-center text-white
        ${isUser ? 'bg-blue-600' : 'bg-neutral-700'}
      `}>
        {isUser ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
      </div>
      
      {/* Content */}
      <div className="flex-grow min-w-0"> {/* Added min-w-0 for flexbox truncation */}
        
        {/* --- MODIFIED: Message Header --- */}
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold text-white">{isUser ? "You" : "AI Researcher"}</h3>
          
          {/* --- NEW: Copy Button --- */}
          {!isUser && !isStreaming && msg.content && (
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors"
              title="Copy response"
            >
              {isCopied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-green-400" />
                  <span className="text-green-400">Copied!</span>
                </>
              ) : (
                <>
                  <Clipboard className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          )}
          {/* --- END: Copy Button --- */}

        </div>
        {/* --- END: Message Header --- */}

        <div
          className={`
            max-w-full md:max-w-3xl text-sm
            ${isUser
              ? 'text-neutral-200'
              : 'text-neutral-300'
            }`}
        >
          {isUser ? (
            <p className="break-words">{msg.content}</p> // Added break-words for long user text
          ) : (
            <div className="prose prose-invert max-w-none">
              <ReactMarkdown>{msg.content}</ReactMarkdown>
              {isStreaming && (
                <span className="inline-block w-2 h-4 bg-white animate-pulse" />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// --- Main ChatMessages Component (Unchanged) ---
export default function ChatMessages({ messages, isLoading, isLoadingConversation, session }) {
  
  if (isLoadingConversation) {
    return (
      <main className="flex-1 overflow-y-auto p-4">
        <ConversationLoader />
      </main>
    );
  }

  if (messages.length === 0) {
    return (
      <main className="flex-1 overflow-y-auto p-4">
        <WelcomeScreen session={session} />
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="max-w-3xl mx-auto space-y-8">
        {messages.map((msg, index) => (
          <Message
            key={index}
            msg={msg}
            isStreaming={
              isLoading && // is a new message being generated?
              index === messages.length - 1 && // is this the last message?
              msg.role === 'ai' // is it from the AI?
            }
          />
        ))}
      </div>
    </main>
  );
}