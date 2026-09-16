/**
 * Texto da versão do app exibido no Perfil.
 *
 * Existe para o suporte: "qual versão aparece no fim do Perfil?" responde de
 * uma vez qual APK a pessoa instalou, inclusive se é um build de teste
 * (`1.6.0+dev.12.abc1234`). Ver docs/VERSIONAMENTO.md.
 */

/** O pedaço do `Constants.expoConfig` que interessa aqui. */
export interface ConfiguracaoDaVersao {
  version?: string;
  android?: { versionCode?: number };
}

export interface VersaoDoApp {
  /** O que aparece na tela, ex.: "Versão 1.7.0 (1007000)". */
  texto: string;
  /** O que o leitor de tela fala. */
  rotuloAcessivel: string;
}

/**
 * Monta o texto da versão; `null` quando o build não informou a versão.
 *
 * @param configuracao `Constants.expoConfig` (pode faltar em ambientes sem manifesto).
 */
export function descreverVersaoDoApp(
  configuracao: ConfiguracaoDaVersao | null | undefined,
): VersaoDoApp | null {
  const versao = configuracao?.version?.trim();
  if (versao === undefined || versao === '') {
    return null;
  }

  const codigo = configuracao?.android?.versionCode;
  if (codigo === undefined) {
    return { texto: `Versão ${versao}`, rotuloAcessivel: `Versão do aplicativo ${versao}` };
  }

  return {
    texto: `Versão ${versao} (${codigo})`,
    rotuloAcessivel: `Versão do aplicativo ${versao}, código ${codigo}`,
  };
}
