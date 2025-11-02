// src/components/AuthForm.js
"use client"; // Needs client-side interactivity

import { useState } from 'react';
import { supabase } from '../lib/supabaseClient'; // Import Supabase client

// This component receives the current session status as a prop
// It only renders if there is NO session (user is logged out)
export default function AuthForm({ session }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSigningUp, setIsSigningUp] = useState(false); // Toggle between login/signup
  const [message, setMessage] = useState(null); // NEW: For success/info messages

  // Don't render the form if the user is already logged in
  if (session) {
    return null; 
  }

  // NEW: Function to handle password reset request
  const handlePasswordReset = async () => {
    setMessage(null);
    setAuthError(null);
    if (!email) {
      setAuthError("Please enter your email address to reset your password.");
      return;
    }

    setIsLoading(true);
    try {
      // This sends the reset link to the user's email
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        // This is the URL your user will be sent to after clicking the email link
        // It should point back to your app's home page.
        redirectTo: `${window.location.origin}/`, 
      });

      if (error) throw error;
      setMessage("Password reset link sent! Check your email (and spam folder).");

    } catch (error) {
      console.error('Password reset error:', error.message);
      setAuthError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Main login/signup function
  const handleAuthAction = async (e) => {
    e.preventDefault();
    setAuthError(null);
    setMessage(null); // Clear info message on new action
    setIsLoading(true);

    try {
      let response;
      if (isSigningUp) {
        // Sign Up
        response = await supabase.auth.signUp({ 
          email, 
          password,
          options: {
            // Optional: You can add emailRedirectTo here for sign-up confirmation
            // emailRedirectTo: `${window.location.origin}/`
          }
        });
        if (!response.error) {
          setMessage("Sign-up successful! Please check your email to confirm.");
        }
      } else {
        // Sign In
        response = await supabase.auth.signInWithPassword({ email, password });
      }

      if (response.error) {
        throw response.error;
      }
      // On successful login, the onAuthStateChange listener in page.js will take over.
      // On successful sign-up, we show the message.

    } catch (error) {
      console.error('Auth error:', error.message);
      setAuthError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-grow flex items-center justify-center p-4">
      <form
        onSubmit={handleAuthAction}
        className="w-full max-w-sm p-8 bg-neutral-900 rounded-lg shadow-md border border-neutral-800"
      >
        <h2 className="text-2xl font-bold mb-6 text-center text-white">
          {isSigningUp ? 'Create Account' : 'Welcome Back'}
        </h2>
        
        <div className="mb-4">
          <label className="block text-neutral-400 mb-2" htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full p-3 border border-neutral-700 rounded-lg bg-neutral-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-neutral-400 mb-2" htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6} // Supabase default minimum
            className="w-full p-3 border border-neutral-700 rounded-lg bg-neutral-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* --- MODIFIED: Show Error or Success Message --- */}
        {authError && <p className="text-red-400 text-sm mb-4">{authError}</p>}
        {message && <p className="text-green-400 text-sm mb-4">{message}</p>}

        {/* --- NEW: Forgot Password Button --- */}
        {!isSigningUp && (
          <button
            type="button"
            onClick={handlePasswordReset}
            disabled={isLoading}
            className="text-sm text-blue-400 hover:underline text-left w-full mb-5"
          >
            Forgot your password?
          </button>
        )}
        
        <button
          type="submit"
          disabled={isLoading}
          className={`w-full px-6 py-3 rounded-lg text-white font-semibold transition-colors ${
            isLoading
              ? 'bg-neutral-600 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {isLoading ? 'Processing...' : (isSigningUp ? 'Sign Up' : 'Login')}
        </button>
        
        <button
          type="button" // Important: type="button" to prevent form submission
          onClick={() => { setIsSigningUp(!isSigningUp); setAuthError(null); setMessage(null); }}
          className="mt-4 text-sm text-neutral-400 hover:text-white text-center w-full"
        >
          {isSigningUp ? 'Already have an account? Login' : 'Need an account? Sign Up'}
        </button>
      </form>
    </div>
  );
}