# Verba

Aprenda um idioma lendo um clássico, frase a frase: toque numa palavra para ver a tradução e ouvir a pronúncia, guarde as que quiser revisar e responda perguntas curtas sobre o que acabou de ler.

## Rodar

```bash
npm install
npm run dev     # desenvolvimento
npm run build   # gera dist/, um site estático (funciona em qualquer caminho)
```

## Como está organizado

- `public/content/index.json`: a estante (livros, idioma, nível, cor da capa).
- `public/content/<id>/book.json`: cada livro, dividido em frases (`segments`) com as palavras traduzidas (`words`) e um exercício a cada poucas frases.
- `src/lib/books.ts`: carrega os livros, divide em páginas e alinha as palavras traduzidas com o texto.
- `src/lib/store.ts`: progresso, sequência de dias, ajustes e palavras guardadas, salvos primeiro no próprio aparelho (`localStorage`).
- `src/lib/sync.ts`: login por e-mail (Supabase) e cópia do progresso na nuvem, mesclada entre aparelhos. A tabela está em `supabase/migrations/`. O login aceita o link ou o código numérico do e-mail; o código precisa de `{{ .Token }}` no modelo "Magic Link" do Supabase (Authentication → Emails), porque o link só funciona no mesmo navegador que pediu o acesso.
- `src/lib/generate.ts`: exercícios montados a partir de cada página e revisão espaçada das palavras guardadas.
- `src/pages/`: início (`Home`), leitura (`Reader`), revisão (`Review`), lista de palavras (`Words`) e ajustes (`Settings`).

O áudio usa as vozes do próprio aparelho (Web Speech API).
