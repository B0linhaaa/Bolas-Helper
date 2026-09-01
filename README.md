# Bolas Helper

Análise de jogos de futebol com resultados reais e odds de casa. Em cada jogo: aposta mais provável, arriscada e muito arriscada.

## Correr

```bash
cd bolas-helper
npm install
npm run dev
```

Abre [http://localhost:3001](http://localhost:3001) se a 3000 já estiver ocupada.

## Email quando as odds abrirem (SMTP)

1. Abre `bolas-helper/.env.local` e troca os três sítios `o-teu-email@gmail.com` pelo teu Gmail.
2. Em `SMTP_PASS` mete uma [palavra-passe de aplicação](https://myaccount.google.com/apppasswords) (não a password da conta). É preciso ter 2FA no Gmail.
3. Reinicia `npm run dev`.
4. Testa o envio:

```bash
cd bolas-helper
npm run test-email
```

5. Para ficar a vigiar (outro terminal, com o site ligado):

```bash
npm run watch-odds
```

Outlook: `SMTP_HOST=smtp.office365.com`. Outro servidor: muda `SMTP_HOST` e `SMTP_PORT`.

## O que faz

- Calendário e forma recente via ESPN
- Odds DraftKings quando o mercado já abriu
- Modelo de golos (Poisson) para os três níveis de aposta

18+. Análise, não garantia.
