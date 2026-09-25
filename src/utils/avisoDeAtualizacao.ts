/**
 * Regras do aviso de atualização do app (contrato § 12.3, D53, T48).
 *
 * Tudo aqui é puro: nada de rede, relógio ou armazenamento. O serviço consulta
 * o GitHub e o hook decide quando; estas funções só dizem **se** há versão
 * nova e **qual link** abrir.
 *
 * O link é sempre montado a partir da tag já validada, nunca lido da resposta
 * (achado S6 da revisão do contrato): se a release fosse adulterada, o app
 * continuaria abrindo só o endereço oficial do repositório.
 */

/** Repositório público de onde saem as releases (§ 12.3). */
const REPOSITORIO = 'yagoriccomi/snake-thai';

/** Última release publicada: o GitHub já ignora rascunho e pré-lançamento. */
export const URL_DA_ULTIMA_RELEASE = `https://api.github.com/repos/${REPOSITORIO}/releases/latest`;

const URL_DAS_RELEASES = `https://github.com/${REPOSITORIO}/releases`;

/** `tag_name` aceita: `vX.Y.Z`, sem sufixo nem espaço. */
const PADRAO_DA_TAG = /^v(\d+)\.(\d+)\.(\d+)$/;

/** Núcleo `X.Y.Z` da versão instalada, antes do `+` do build fora da tag. */
const PADRAO_DA_VERSAO_INSTALADA = /^(\d+)\.(\d+)\.(\d+)(?:\+.*)?$/;

/** Fuso em que o "dia" do aviso vira (§ 12.3). */
const FUSO_DA_ACADEMIA = 'America/Sao_Paulo';

/**
 * Deslocamento de São Paulo sem horário de verão (abolido em 2019). Só é usado
 * se o motor JavaScript não souber o fuso pelo nome.
 */
const DESLOCAMENTO_DE_SAO_PAULO_EM_MS = -3 * 60 * 60 * 1000;

export interface Versao {
  major: number;
  minor: number;
  patch: number;
}

/** O pedaço da resposta do GitHub que o aviso usa. */
export interface AssetDaRelease {
  name?: unknown;
  browser_download_url?: unknown;
}

export interface ReleaseDoGithub {
  tag_name?: unknown;
  assets?: unknown;
}

/** O que o cartão precisa mostrar e abrir. */
export interface AtualizacaoDisponivel {
  /** Versão instalada, só o núcleo (ex.: `1.9.0`). */
  instalada: string;
  /** Versão nova (ex.: `2.0.0`). */
  nova: string;
  /** Link montado: o APK, ou a página da tag quando o APK não está na release. */
  link: string;
}

const paraVersao = (encontrado: RegExpExecArray): Versao => ({
  major: Number(encontrado[1]),
  minor: Number(encontrado[2]),
  patch: Number(encontrado[3]),
});

const formatar = ({ major, minor, patch }: Versao): string => `${major}.${minor}.${patch}`;

/**
 * Lê o `tag_name` da release. `null` fora do formato `vX.Y.Z` (e aí o aviso não
 * aparece).
 */
export function lerTagDaRelease(tag: unknown): Versao | null {
  if (typeof tag !== 'string') return null;
  const encontrado = PADRAO_DA_TAG.exec(tag);
  return encontrado === null ? null : paraVersao(encontrado);
}

/**
 * Lê a versão instalada (`Constants.expoConfig.version`). Build fora da tag
 * tem `+N.sha` ou `+dev.N.sha`: vale só o núcleo antes do `+`.
 */
export function lerVersaoInstalada(versao: string | null | undefined): Versao | null {
  if (versao === null || versao === undefined) return null;
  const encontrado = PADRAO_DA_VERSAO_INSTALADA.exec(versao.trim());
  return encontrado === null ? null : paraVersao(encontrado);
}

/** `true` só se `nova` for maior que `instalada`, parte a parte, como números. */
export function ehVersaoMaior(nova: Versao, instalada: Versao): boolean {
  if (nova.major !== instalada.major) return nova.major > instalada.major;
  if (nova.minor !== instalada.minor) return nova.minor > instalada.minor;
  return nova.patch > instalada.patch;
}

/**
 * O link do botão **Baixar atualização**. O APK só é oferecido se a release
 * tiver o asset de nome exato `snake-thai-vX.Y.Z.apk` com a URL exatamente igual
 * à montada; senão, a página da tag (também montada). O `.aab` é ignorado.
 */
export function montarLinkDaAtualizacao(nova: Versao, assets: unknown): string {
  const tag = `v${formatar(nova)}`;
  const nomeDoApk = `snake-thai-${tag}.apk`;
  const linkDoApk = `${URL_DAS_RELEASES}/download/${tag}/${nomeDoApk}`;

  const lista: unknown[] = Array.isArray(assets) ? assets : [];
  const temOApk = lista.some((asset) => {
    if (typeof asset !== 'object' || asset === null) return false;
    const { name, browser_download_url: url } = asset as AssetDaRelease;
    return name === nomeDoApk && url === linkDoApk;
  });

  return temOApk ? linkDoApk : `${URL_DAS_RELEASES}/tag/${tag}`;
}

/**
 * Decide o aviso a partir da release e da versão instalada. `null` = não
 * mostra (tag fora do formato, versão instalada desconhecida, igual ou maior).
 */
export function avaliarAtualizacao(
  release: ReleaseDoGithub,
  versaoInstalada: string | null | undefined,
): AtualizacaoDisponivel | null {
  const nova = lerTagDaRelease(release.tag_name);
  const instalada = lerVersaoInstalada(versaoInstalada);
  if (nova === null || instalada === null) return null;
  if (!ehVersaoMaior(nova, instalada)) return null;

  return {
    instalada: formatar(instalada),
    nova: formatar(nova),
    link: montarLinkDaAtualizacao(nova, release.assets),
  };
}

/**
 * Data `AAAA-MM-DD` em São Paulo: o "dia" do limite de uma consulta e um
 * aviso por dia.
 */
export function diaEmSaoPaulo(agora: Date): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: FUSO_DA_ACADEMIA,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(agora);
  } catch {
    return new Date(agora.getTime() + DESLOCAMENTO_DE_SAO_PAULO_EM_MS).toISOString().slice(0, 10);
  }
}
