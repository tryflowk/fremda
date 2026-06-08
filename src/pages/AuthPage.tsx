import { useState } from 'react';
import { BookOpen } from 'lucide-react';
import { useAuthContext } from '@/lib/auth';
import { Spinner } from '@/components/Spinner';

type Mode = 'signin' | 'signup';

export function AuthPage() {
  const { signIn, signUp } = useAuthContext();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    const fn = mode === 'signin' ? signIn : signUp;
    const { error: err } = await fn(email, password);

    setLoading(false);
    if (err) {
      setError(err);
    } else if (mode === 'signup') {
      setSuccess('Conta criada! Verifique seu e-mail para confirmar o cadastro.');
    }
  }

  const inputStyle: React.CSSProperties = {
    background: 'var(--color-surface-2)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text)',
    borderRadius: '12px',
    padding: '12px 14px',
    fontSize: '15px',
    outline: 'none',
    width: '100%',
    transition: 'border-color 0.2s',
  };

  return (
    <div
      className="min-h-dvh flex flex-col items-center justify-center px-5"
      style={{ background: 'var(--color-bg)' }}
    >
      {/* Logo */}
      <div className="flex flex-col items-center mb-8">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: 'var(--color-accent)' }}
        >
          <BookOpen size={28} color="white" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--color-text)' }}>
          Fremda Libro
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-muted)' }}>
          Aprenda idiomas lendo literatura clássica
        </p>
      </div>

      {/* Card */}
      <div
        className="w-full max-w-sm rounded-2xl p-6 border"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        {/* Tabs */}
        <div
          className="flex rounded-xl p-1 mb-6"
          style={{ background: 'var(--color-surface-2)' }}
        >
          {(['signin', 'signup'] as Mode[]).map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(null); setSuccess(null); }}
              className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: mode === m ? 'var(--color-accent)' : 'transparent',
                color: mode === m ? 'white' : 'var(--color-muted)',
              }}
            >
              {m === 'signin' ? 'Entrar' : 'Criar conta'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            style={inputStyle}
            onFocus={e => (e.currentTarget.style.borderColor = 'var(--color-accent)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
          />
          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={6}
            style={inputStyle}
            onFocus={e => (e.currentTarget.style.borderColor = 'var(--color-accent)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
          />

          {error && (
            <p className="text-sm rounded-lg px-3 py-2" style={{ background: 'rgba(248,113,113,0.1)', color: 'var(--color-error)' }}>
              {error}
            </p>
          )}
          {success && (
            <p className="text-sm rounded-lg px-3 py-2" style={{ background: 'rgba(74,222,128,0.1)', color: 'var(--color-success)' }}>
              {success}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-60"
            style={{ background: 'var(--color-accent)', color: 'white' }}
          >
            {loading && <Spinner size={16} />}
            {mode === 'signin' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>
      </div>
    </div>
  );
}
