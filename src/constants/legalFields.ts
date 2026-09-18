/**
 * Campos que a academia preenche para montar a Política de Privacidade e os
 * Termos de Uso. A chave é o marcador `{{chave}}` do modelo em `docs/legal/`;
 * quem monta o texto é o banco, na hora de publicar.
 *
 * O rótulo e a ajuda existem porque quem preenche é o dono da academia, não um
 * advogado: "base legal do art. 11" sozinho não diz o que escrever ali.
 */

/** Como o campo é digitado na tela. */
export type TipoDeCampoLegal = 'curto' | 'longo';

export interface CampoLegal {
  /** Marcador no modelo, ex.: `cnpj` para `{{cnpj}}`. */
  id: string;
  rotulo: string;
  ajuda: string;
  tipo: TipoDeCampoLegal;
  /** Onde o valor aparece, para a pessoa saber o peso do que escreve. */
  onde: string;
}

/** Seções da tela, na ordem de preenchimento. */
export interface SecaoDeCamposLegais {
  titulo: string;
  campos: CampoLegal[];
}

export const SECOES_DE_CAMPOS_LEGAIS: readonly SecaoDeCamposLegais[] = [
  {
    titulo: 'IDENTIFICAÇÃO DA ACADEMIA',
    campos: [
      {
        id: 'razao_social',
        rotulo: 'Razão social',
        ajuda: 'O nome da empresa como está no CNPJ, não o nome fantasia.',
        tipo: 'curto',
        onde: 'Política e Termos',
      },
      {
        id: 'cnpj',
        rotulo: 'CNPJ',
        ajuda: 'Com pontuação, como aparece no cartão CNPJ.',
        tipo: 'curto',
        onde: 'Política e Termos',
      },
      {
        id: 'endereco',
        rotulo: 'Endereço completo',
        ajuda: 'Rua, número, bairro, cidade/UF e CEP.',
        tipo: 'longo',
        onde: 'Política',
      },
      {
        id: 'canal_contato',
        rotulo: 'Canal de contato',
        ajuda: 'E-mail ou telefone para onde vão os pedidos de privacidade e as dúvidas sobre os termos.',
        tipo: 'curto',
        onde: 'Política e Termos',
      },
      {
        id: 'encarregado',
        rotulo: 'Responsável pelo atendimento (encarregado)',
        ajuda:
          'Nome e forma de contato de quem responde os pedidos de privacidade. Academia pequena pode indicar o próprio dono — confirme com a assessoria jurídica.',
        tipo: 'longo',
        onde: 'Política',
      },
    ],
  },
  {
    titulo: 'PRAZOS DE GUARDA',
    campos: [
      {
        id: 'prazo_mensalidades',
        rotulo: 'Mensalidades',
        ajuda: 'Por quanto tempo os registros de pagamento ficam guardados. Combine com o contador.',
        tipo: 'curto',
        onde: 'Política',
      },
      {
        id: 'prazo_comprovantes',
        rotulo: 'Imagens de comprovante',
        ajuda:
          'Precisa bater com o prazo de guarda configurado no app. Se lá estiver desligado, escreva "enquanto a conta existir".',
        tipo: 'curto',
        onde: 'Política',
      },
      {
        id: 'prazo_auditoria',
        rotulo: 'Trilha de auditoria',
        ajuda: 'Quanto tempo fica o registro de quem alterou o quê.',
        tipo: 'curto',
        onde: 'Política',
      },
      {
        id: 'prazo_backups',
        rotulo: 'Cópias de segurança',
        ajuda: 'Prazo de retenção dos backups do banco de dados, conforme o plano contratado.',
        tipo: 'curto',
        onde: 'Política',
      },
    ],
  },
  {
    titulo: 'PONTOS PARA A ASSESSORIA JURÍDICA',
    campos: [
      {
        id: 'base_legal_saude',
        rotulo: 'Base legal do dado de saúde',
        ajuda:
          'Justificativa de falta pode trazer atestado. Qual inciso do art. 11 da LGPD autoriza esse uso, na opinião da sua assessoria.',
        tipo: 'longo',
        onde: 'Política',
      },
      {
        id: 'transferencia_internacional',
        rotulo: 'Transferência internacional',
        ajuda:
          'Como se justifica o envio de dados para fora do Brasil (banco e servidor nos EUA, monitoramento na Europa). Ex.: cláusulas-padrão contratuais.',
        tipo: 'longo',
        onde: 'Política',
      },
      {
        id: 'menores_de_idade',
        rotulo: 'Alunos menores de 18 anos',
        ajuda:
          'Como a matrícula do menor é feita, quem é o responsável que autoriza e como ele exerce os direitos do aluno (art. 14 da LGPD).',
        tipo: 'longo',
        onde: 'Política',
      },
      {
        id: 'regiao_cloudinary',
        rotulo: 'Região da conta Cloudinary',
        ajuda: 'Onde ficam as imagens de comprovante. Está no painel da Cloudinary, em Settings.',
        tipo: 'curto',
        onde: 'Política',
      },
    ],
  },
  {
    titulo: 'TERMOS DE USO',
    campos: [
      {
        id: 'contrato_matricula',
        rotulo: 'Contrato ou regulamento da academia',
        ajuda: 'Nome do documento que rege valores, trancamento e cancelamento.',
        tipo: 'curto',
        onde: 'Termos',
      },
      {
        id: 'foro',
        rotulo: 'Foro (cidade e estado)',
        ajuda: 'Comarca onde eventuais ações são propostas. Ex.: "São Paulo/SP".',
        tipo: 'curto',
        onde: 'Termos',
      },
    ],
  },
];

/** Todos os campos, na ordem das seções. */
export const CAMPOS_LEGAIS: readonly CampoLegal[] = SECOES_DE_CAMPOS_LEGAIS.flatMap((secao) => secao.campos);

/** Limite que o banco também impõe (`legal_field_values_tamanho`). */
export const LIMITE_DO_CAMPO_LEGAL = 2000;
