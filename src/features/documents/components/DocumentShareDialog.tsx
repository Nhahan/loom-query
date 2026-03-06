'use client';

import { useState } from 'react';
import { z } from 'zod';

const ShareSchema = z.object({
  email: z.string().email('Invalid email address'),
});

interface DocumentShareDialogProps {
  documentId: string;
  documentName: string;
  currentOwner: string;
  sharedUsers: string[];
  onClose: () => void;
  onShareSuccess?: () => void;
}

export function DocumentShareDialog({
  documentId,
  documentName,
  currentOwner,
  sharedUsers,
  onClose,
  onShareSuccess,
}: DocumentShareDialogProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const parsed = ShareSchema.safeParse({ email });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || 'Invalid email');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`/api/documents/${documentId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to share document');
        return;
      }

      setSuccessMessage(`Document shared with ${email}`);
      setEmail('');

      onShareSuccess?.();

      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      setError('Failed to share document');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Share Document</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="mb-4 pb-4 border-b">
          <p className="text-sm text-gray-600 mb-1">Document: {documentName}</p>
          <p className="text-sm text-gray-600 mb-3">Owner: {currentOwner}</p>

          {sharedUsers.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Shared with:</p>
              <ul className="text-sm text-gray-600 space-y-1">
                {sharedUsers.map((user) => (
                  <li key={user} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                    {user}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <form onSubmit={handleShare} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Share with (email address)
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              disabled={loading}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {successMessage && <p className="text-sm text-green-600">{successMessage}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading || !email}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300 cursor-pointer"
            >
              {loading ? 'Sharing...' : 'Share'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50 disabled:bg-gray-100"
            >
              Close
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
