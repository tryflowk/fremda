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
- `src/lib/store.ts`: progresso, sequência de dias, meta diária e palavras guardadas (no próprio aparelho, via `localStorage`).
- `src/pages/`: início (`Home`), leitura (`Reader`) e revisão das palavras (`Review`).

O áudio usa as vozes do próprio aparelho (Web Speech API).
