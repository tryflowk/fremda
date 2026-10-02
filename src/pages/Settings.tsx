import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { actions, useStore } from '@/lib/store';
import { sendLoginLink, signOut, useSync } from '@/lib/sync';
import { speak } from '@/lib/tts';
import { ArrowLeft, Cloud, Speaker } from '@/components/Icons';

const GOALS = [5, 10, 15, 25, 40];
const RATES = [
  { value: 0.75, label: 'Devagar' },
  { value: 1, label: 'Normal' },
];

export default function Settings() {
  const { settings, words } = useStore();
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col gap-6 px-5 pt-4 pb-10">
      <header className="flex items-center gap-2">
        <Link to="/" aria-label="Voltar ao início" className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-sand">
          <ArrowLeft />
        </Link>
        <h1 className="m-0 font-display text-[26px] font-semibold">Ajustes</h1>
      </header>

      <Account />

      <Link to="/palavras" className="card flex items-center justify-between p-4 text-ink no-underline">
        <span className="text-[15px] font-semibold">Palavras guardadas</span>
        <span className="text-sm font-semibold text-muted">{Object.keys(words).length} ›</span>
      </Link>

      <Section title="Meta diária" hint="Quantas frases você quer ler por dia.">
        <Segmented
          options={GOALS.map(g => ({ value: g, label: String(g) }))}
          value={settings.goal}
          onChange={goal => actions.setSettings({ goal })}
          label="Meta diária em frases"
        />
      </Section>

      <Section title="Voz" hint="Velocidade da leitura em voz alta.">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <Segmented
              options={RATES}
              value={settings.voiceRate}
              onChange={voiceRate => actions.setSettings({ voiceRate })}
              label="Velocidade da voz"
            />
          </div>
          <button
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-card"
            onClick={() => speak('É nesta velocidade que as frases são lidas.', 'pt-BR')}
            aria-label="Ouvir um exemplo"
          >
            <Speaker />
          </button>
        </div>
      </Section>

      <Section title="Leitura">
        <Toggle
          label="Revisar palavras guardadas durante a leitura"
          hint="Elas voltam como exercícios entre as frases, em intervalos cada vez maiores."
          checked={settings.reviewInReading}
          onChange={reviewInReading => actions.setSettings({ reviewInReading })}
        />
        <Toggle
          label="Marcar palavras com tradução"
          hint="Um pontilhado discreto sob as palavras que você pode tocar."
          checked={settings.hints}
          onChange={hints => actions.setSettings({ hints })}
        />
      </Section>
    </div>
  );
}

function Account() {
  const { email, status } = useSync();
  const [input, setInput] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (email) {
    const line = { off: '', syncing: 'Salvando…', saved: 'Tudo salvo na nuvem.', error: 'Não consegui salvar agora. Tento de novo em seguida.' }[status];
    return (
      <section className="card flex flex-col gap-3 p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-ok-ink">
          <Cloud size={18} /> Progresso salvo na sua conta
        </div>
        <div className="font-book text-[17px] break-all">{email}</div>
        <div className="text-sm text-muted">{line}</div>
        <button className="btn-soft self-start" onClick={() => void signOut()}>
          Sair desta conta
        </button>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3 rounded-[20px] bg-ink p-5 text-paper">
      <div className="flex items-center gap-2 font-display text-xl font-semibold">
        <Cloud /> Salve seu progresso
      </div>
      <p className="m-0 font-book text-[15px] leading-snug text-[#CFC5B6]">
        Hoje tudo fica só neste aparelho. Entre com seu e-mail para guardar livros, palavras e sequência na nuvem
        e continuar em qualquer lugar.
      </p>
      {sent ? (
        <p className="m-0 rounded-2xl bg-ink-2 px-4 py-3 font-book text-[15px]">
          Enviamos um link para <strong>{input}</strong>. Abra o e-mail neste aparelho e toque no link para entrar.
        </p>
      ) : (
        <form
          className="flex flex-col gap-2.5"
          onSubmit={async e => {
            e.preventDefault();
            setBusy(true);
            const err = await sendLoginLink(input.trim());
            setBusy(false);
            if (err) setError('Não consegui enviar o link. Confira o e-mail e tente de novo.');
            else setSent(true);
          }}
        >
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="seu@email.com"
            value={input}
            onChange={e => {
              setInput(e.target.value);
              setError(null);
            }}
            className="h-12 rounded-full border border-ink-2 bg-paper px-4 text-[16px] text-ink outline-none focus:border-peach"
            aria-label="Seu e-mail"
          />
          <button className="btn-primary" disabled={busy || !input.includes('@')}>
            {busy ? 'Enviando…' : 'Receber link de acesso'}
          </button>
          {error && <p className="m-0 text-sm text-peach">{error}</p>}
        </form>
      )}
    </section>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="m-0 font-display text-lg font-semibold">{title}</h2>
        {hint && <p className="m-0 mt-0.5 text-sm text-muted">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Segmented<T extends number>(props: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={props.label} className="flex rounded-full border border-line bg-card p-1">
      {props.options.map(o => {
        const on = o.value === props.value;
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={on}
            onClick={() => props.onChange(o.value)}
            className={`h-10 flex-1 rounded-full text-[15px] font-semibold transition ${on ? 'bg-ink text-paper' : 'text-ink-2'}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Toggle(props: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={props.checked}
      onClick={() => props.onChange(!props.checked)}
      className="card flex items-center gap-4 p-4 text-left"
    >
      <span className="flex flex-1 flex-col gap-0.5">
        <span className="text-[15px] font-semibold">{props.label}</span>
        <span className="text-[13px] text-muted">{props.hint}</span>
      </span>
      <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${props.checked ? 'bg-accent' : 'bg-track'}`}>
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${props.checked ? 'left-[22px]' : 'left-0.5'}`} />
      </span>
    </button>
  );
}
