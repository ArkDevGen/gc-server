import { useEffect, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { HelpCircle, X, CheckCircle, Send } from 'lucide-react';

/**
 * Floating "?" button anchored to the bottom-right of every authenticated
 * page. Click to open a contact form that sends an email to support via
 * Resend (configured per-deployment with CLIENT_NAME, SUPPORT_TO_EMAIL,
 * RESEND_API_KEY env vars).
 */
export default function SupportButton() {
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [supportTo, setSupportTo] = useState('');

  // Check whether the backend has a working Resend config. If not, we still
  // show the button but the modal explains how to email directly.
  useEffect(() => {
    api.get('/support/config')
      .then((res) => {
        setEnabled(!!res.data.enabled);
        setSupportTo(res.data.support_to || '');
      })
      .catch(() => setEnabled(false));
  }, []);

  if (enabled === null) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Get help"
        className="fixed bottom-5 right-5 z-40 w-12 h-12 rounded-full bg-primary-600 text-white shadow-lg hover:bg-primary-700 hover:shadow-xl transition-all flex items-center justify-center group"
        title="Get help / Contact support"
      >
        <HelpCircle size={22} />
        <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 whitespace-nowrap bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          Need help?
        </span>
      </button>

      {open && (
        <SupportModal
          onClose={() => setOpen(false)}
          enabled={enabled}
          supportTo={supportTo}
        />
      )}
    </>
  );
}

function SupportModal({ onClose, enabled, supportTo }: {
  onClose: () => void;
  enabled: boolean;
  supportTo: string;
}) {
  const { user } = useAuth();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState(user?.email || '');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true); setError('');
    try {
      await api.post('/support/contact', {
        subject,
        message,
        email: email || undefined,
        page_url: window.location.href,
      });
      setSent(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to send. Please email support directly.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <HelpCircle size={18} className="text-primary-600" /> Contact Support
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        {sent ? (
          <div className="p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-3">
              <CheckCircle size={28} />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Message sent</h3>
            <p className="text-sm text-gray-600 mt-1">
              We received your question. Someone from Ark Support will get back to you{email ? <> at <strong>{email}</strong></> : ' soon'}.
            </p>
            <button onClick={onClose}
              className="mt-5 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700">
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-4 space-y-3">
            {!enabled && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm px-3 py-2 rounded-lg">
                Support form isn't configured yet on this server.{' '}
                {supportTo && <>Email <a href={`mailto:${supportTo}`} className="font-medium underline">{supportTo}</a> directly.</>}
              </div>
            )}

            <p className="text-sm text-gray-600">
              Stuck? Have a question? Send us a message and we'll get back to you.
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject *</label>
              <input value={subject} required maxLength={200}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. How do I record material usage on a build?"
                className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Message *</label>
              <textarea value={message} required maxLength={5000} rows={5}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us what you're trying to do, and what's going wrong or unclear..."
                className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reply to {!email && <span className="text-xs font-normal text-gray-500">(so we can write back)</span>}
              </label>
              <input type="email" value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>

            {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 border rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit" disabled={sending || !enabled}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50">
                <Send size={14} /> {sending ? 'Sending...' : 'Send Message'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
