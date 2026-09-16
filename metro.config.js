// Configuração do Metro com o Sentry (docs/RUNBOOK.md, "Monitoramento de erros").
//
// Gera Debug IDs no bundle e no source map do Hermes: é o que faz o painel do
// Sentry mostrar `src/screens/...` em vez de `index.android.bundle:1:48213`.
// Não envia nada sozinho; o upload acontece no build de release, com token.
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

module.exports = getSentryExpoConfig(__dirname);
