// src/components/UploaderModal.js
"use client";

import { useState, Fragment } from 'react';
import { Upload, FileText, Loader2, CheckCircle, AlertTriangle, X } from 'lucide-react';
import { Dialog, Transition } from '@headlessui/react';

export default function UploaderModal({ isOpen, setIsOpen, userId }) {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusType, setStatusType] = useState('info'); // 'info', 'success', 'error'

  const closeModal = () => {
    if (isProcessing) return; // Don't close while processing
    setIsOpen(false);
    setTimeout(() => {
      setFile(null);
      setStatus('');
      setStatusType('info');
    }, 300); 
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0] || null;
    setFile(selectedFile);
    if (selectedFile) {
      setStatus(`Ready to upload: ${selectedFile.name}`);
      setStatusType('info');
    } else {
      setStatus('');
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file || !userId) {
      setStatus("Please select a file.");
      setStatusType('error');
      return;
    }
    
    setIsProcessing(true);
    setStatus(`Processing ${file.name}... (this may take a moment)`);
    setStatusType('info');

    const formData = new FormData();
    formData.append("file", file);
    
    try {
      // --- UPDATED URL ---
      const response = await fetch(`https://ai-researcher-backend-tyr0.onrender.com/upload_document?user_id=${userId}`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.detail || `HTTP Error ${response.status}`);
      }

      setStatus(`Success: ${result.message}`);
      setStatusType('success');
      setFile(null); 
      
      setTimeout(() => {
         closeModal();
      }, 2000);

    } catch (error)
 {
      console.error('Upload Error:', error);
      setStatus(`Upload failed: ${error.message}`);
      setStatusType('error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={closeModal}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl 
                bg-neutral-900 border border-neutral-800 
                p-6 text-left align-middle shadow-xl transition-all"
              >
                <Dialog.Title
                  as="h3"
                  className="text-lg font-medium leading-6 text-white"
                >
                  Upload Document for RAG
                </Dialog.Title>
                <button
                  onClick={closeModal}
                  className="absolute top-4 right-4 text-neutral-500 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
                <p className="mt-2 text-sm text-neutral-400">
                  Upload a PDF, PNG, JPG, or TXT file. The AI will use this document as context.
                </p>

                <form onSubmit={handleUpload} className="mt-6">
                  <label 
                    className="flex flex-col items-center justify-center w-full h-32 
                    border-2 border-dashed border-neutral-700 hover:border-blue-500 
                    rounded-lg cursor-pointer bg-neutral-950 transition-colors"
                  >
                    <input 
                      type="file"
                      onChange={handleFileChange}
                      accept=".pdf,.png,.jpg,.jpeg,.txt,.md"
                      className="hidden"
                      disabled={isProcessing}
                    />
                    {!file && (
                      <div className="flex flex-col items-center justify-center text-neutral-500">
                        <Upload className="w-8 h-8 mb-2" />
                        <span className="font-semibold">Click to choose a file</span>
                        <span className="text-xs">PDF, PNG, JPG, or TXT</span>
                      </div>
                    )}
                    {file && (
                      <div className="flex flex-col items-center justify-center text-green-400">
                        <FileText className="w-8 h-8 mb-2" />
                        <span className="font-semibold text-sm text-center px-2 truncate">
                          {file.name}
                        </span>
                      </div>
                    )}
                  </label>
                  
                  {status && (
                    <p className={`mt-3 text-xs flex items-center gap-2
                      ${statusType === 'error' ? 'text-red-400' :
                         statusType === 'success' ? 'text-green-400' : 'text-blue-300'}
                    `}>
                      {isProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
                      {statusType === 'error' && <AlertTriangle className="w-4 h-4" />}
                      {statusType === 'success' && <CheckCircle className="w-4 h-4" />}
                      {status}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={!file || isProcessing}
                    className="mt-6 w-full flex-shrink-0 px-4 py-2.5 rounded-lg text-white font-semibold 
                    flex items-center justify-center gap-2
                    bg-green-600 hover:bg-green-700
                    disabled:bg-neutral-600 disabled:cursor-not-allowed
                    transition-colors"
                  >
                    {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                    {isProcessing ? 'Processing...' : 'Upload & Process'}
                  </button>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}