// src/app/page.js
"use client";

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import AuthForm from '../components/AuthForm';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import ChatMessages from '../components/ChatMessages';
import ChatInput from '../components/ChatInput';

export default function HomePage() {
  // --- Core State ---
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [query, setQuery] = useState("");
  const [history, setHistory] = useState([]);
  
  const [currentConversationId, setCurrentConversationId] = useState(null); 
  
  // --- UI State ---
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false); 

  // --- Core Side-Effects (Authentication & History) ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchHistory(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (_event === "PASSWORD_RECOVERY") {
        const newPassword = prompt("What would you like your new password to be?");
        if (newPassword) {
          try {
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) throw error;
            alert("Password updated successfully! You can now log in.");
          } catch (error) {
            alert(`Error updating password: ${error.message}`);
          }
        }
      }
      
      setSession(session);
      if (!session) {
        setMessages([]);
        setHistory([]);
        setCurrentConversationId(null); 
      } else {
        fetchHistory(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // --- FUNCTION: Start a new empty conversation ---
  const startNewChat = () => {
    setMessages([]);
    setQuery("");
    setCurrentConversationId(null); 
    setSidebarOpen(false);
  };

  // --- FUNCTION: Fetch conversation history ---
  const fetchHistory = async (userId) => {
      if (!userId) return;
      setIsLoadingHistory(true);
      try {
          const { data, error } = await supabase
              .from('conversations') 
              .select('id, query_text, created_at') 
              .eq('user_id', userId)
              .order('created_at', { ascending: false })
              .limit(20);

          if (error) throw error;
          setHistory(data || []);
          return data; 

      } catch (error) {
          console.error("Error fetching history:", error.message);
          setHistory([]);
          return [];
      } finally {
        setIsLoadingHistory(false);
      }
  };

  // --- MODIFIED: Load ALL messages for a conversation ---
  const loadConversation = async (conversationId) => {
    if (!conversationId || isLoadingConversation) return;

    setIsLoadingConversation(true);
    setMessages([]);
    setSidebarOpen(false); 
    setCurrentConversationId(conversationId);

    try {
        // --- UPDATED URL ---
        const response = await fetch(`https://ai-researcher-backend-tyr0.onrender.com/conversation/${conversationId}`);
        const data = await response.json();

        if (!response.ok) throw new Error(data.detail || 'Failed to load messages.');

        setMessages(data.map(msg => ({ 
            role: msg.role, 
            content: msg.content 
        })));
        
    } catch (error) {
        console.error("Error loading conversation:", error.message);
        setMessages([{role: 'ai', content: `Failed to load conversation: ${error.message}`}]);
    } finally {
        setIsLoadingConversation(false);
    }
  };

  
  // --- FUNCTION: Handle user logout ---
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };


  // --- FUNCTION: Delete a specific conversation ---
  const handleDeleteConversation = async (conversationId) => {
    const convToDelete = history.find(conv => conv.id === conversationId);
    if (!convToDelete) return;
    
    if (!window.confirm(`Are you sure you want to delete the chat: "${convToDelete.query_text}"?`)) {
      return;
    }

    try {
      const { error: messagesError } = await supabase
        .from('messages')
        .delete()
        .eq('conversation_id', conversationId);
        
      if (messagesError) throw messagesError;

      const { error: convError } = await supabase
        .from('conversations')
        .delete()
        .eq('id', conversationId);

      if (convError) throw convError;

      setHistory(prevHistory => prevHistory.filter(conv => conv.id !== conversationId));

      if (currentConversationId === conversationId) {
        startNewChat();
      }

    } catch (error) {
      console.error("Error deleting conversation:", error.message);
      alert(`Failed to delete chat: ${error.message}`);
    }
  };


  // --- FUNCTION: Submit research request ---
  const handleResearch = async () => {
    if (!session || !query || isLoading) return;

    setIsLoading(true);
    const userMessage = { role: 'user', content: query };
    const isNewChat = !currentConversationId;
    
    setMessages(prev => [...prev, userMessage]); 
    setQuery("");
    
    const aiMessagePlaceholder = { role: 'ai', content: '' };
    setMessages(prev => [...prev, aiMessagePlaceholder]);

    try {
      // --- UPDATED URL ---
      const response = await fetch('https://ai-researcher-backend-tyr0.onrender.com/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
             query: userMessage.content,
             user_id: session.user.id,
             conversation_id: currentConversationId
             }),
      });

      if (!response.ok) {
        let errorBody = `HTTP error! status: ${response.status}`;
        try { const errJson = await response.json(); errorBody = errJson.detail || errorBody; } catch (_) {}
        throw new Error(errorBody);
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let aiResponseContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        aiResponseContent += chunk;
        
        setMessages(prev => {
          const updatedMessages = [...prev];
          if (updatedMessages.length > 0 && updatedMessages[updatedMessages.length - 1].role === 'ai') {
            updatedMessages[updatedMessages.length - 1] = { role: 'ai', content: aiResponseContent };
          }
          return updatedMessages;
        });
      }

    } catch (error) {
       console.error("Error fetching research:", error);
       const errorMessage = { role: 'ai', content: `Error: ${error.message}\n\nThere was an issue connecting to the AI service.` };
       
       setMessages(prev => {
          const lastMessageIndex = prev.length - 1;
          if (lastMessageIndex >= 0 && prev[lastMessageIndex].role === 'ai') {
              const updatedMessages = [...prev.slice(0, lastMessageIndex), errorMessage];
              return updatedMessages;
          }
          return [...prev, errorMessage];
       });
    } finally {
      setIsLoading(false);
      
      if (isNewChat && session) {
        const newHistory = await fetchHistory(session.user.id);
        if (newHistory && newHistory.length > 0) {
          setCurrentConversationId(newHistory[0].id);
        }
      }
    }
  };


  // --- Final JSX Render ---
  if (!session) {
    return (
      <div className="flex h-screen bg-neutral-950 text-white">
        <AuthForm session={session} />
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex bg-neutral-950 text-neutral-200">
      <Sidebar
        session={session}
        history={history}
        loadConversation={loadConversation}
        handleLogout={handleLogout}
        startNewChat={startNewChat}
        isLoadingHistory={isLoadingHistory}
        isLoadingConversation={isLoadingConversation}
        handleDeleteConversation={handleDeleteConversation}
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
        isDesktop={false}
      />
      
      <div className="hidden lg:flex lg:flex-shrink-0">
        <Sidebar
          session={session}
          history={history}
          loadConversation={loadConversation}
          handleLogout={handleLogout}
          startNewChat={startNewChat}
          isLoadingHistory={isLoadingHistory}
          isLoadingConversation={isLoadingConversation}
          handleDeleteConversation={handleDeleteConversation}
          isOpen={true}
          isDesktop={true}
        />
      </div>

      <div className="flex flex-1 flex-col min-w-0">
        <Header setIsOpen={setSidebarOpen} />
        
        <ChatMessages 
          messages={messages}
          isLoading={isLoading}
          isLoadingConversation={isLoadingConversation}
          session={session}
        />
        
        <ChatInput 
          query={query}
          setQuery={setQuery}
          isLoading={isLoading || isLoadingConversation}
          handleResearch={handleResearch}
          userId={session.user.id}
        />
      </div>
    </div>
  );
}