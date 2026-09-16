/**
 * Config Plugin da variante DEV: libera HTTP sem TLS SÓ para o próprio
 * computador (127.0.0.1, localhost e 10.0.2.2 do emulador).
 *
 * Por que precisa: o banco local da Supabase CLI e o snake-server local falam
 * HTTP puro, e o build de release do Android bloqueia texto claro. Por que só
 * esses hosts: liberar geral (`usesCleartextTraffic`) deixaria o app DEV aceitar
 * HTTP para qualquer endereço. O celular alcança o computador por `adb reverse`,
 * que aparece para o app como 127.0.0.1. [#60]
 *
 * Nunca entra na variante de produção: app.config.js só o inclui em DEV.
 */
const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');

const NOME_DO_RECURSO = 'network_security_config';

const XML_DE_SEGURANCA = `<?xml version="1.0" encoding="utf-8"?>
<!-- Gerado por plugins/withDevCleartext.js (variante DEV). Não editar à mão. -->
<network-security-config>
  <base-config cleartextTrafficPermitted="false" />
  <domain-config cleartextTrafficPermitted="true">
    <domain includeSubdomains="false">127.0.0.1</domain>
    <domain includeSubdomains="false">localhost</domain>
    <domain includeSubdomains="false">10.0.2.2</domain>
  </domain-config>
</network-security-config>
`;

function withDevCleartext(config) {
  const comManifesto = withAndroidManifest(config, (modificado) => {
    const aplicacao = modificado.modResults.manifest.application?.[0];
    if (aplicacao === undefined) {
      throw new Error('withDevCleartext: <application> não encontrado no AndroidManifest.');
    }
    aplicacao.$['android:networkSecurityConfig'] = `@xml/${NOME_DO_RECURSO}`;
    return modificado;
  });

  return withDangerousMod(comManifesto, [
    'android',
    async (modificado) => {
      const pasta = path.join(modificado.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res', 'xml');
      fs.mkdirSync(pasta, { recursive: true });
      fs.writeFileSync(path.join(pasta, `${NOME_DO_RECURSO}.xml`), XML_DE_SEGURANCA);
      return modificado;
    },
  ]);
}

module.exports = withDevCleartext;
