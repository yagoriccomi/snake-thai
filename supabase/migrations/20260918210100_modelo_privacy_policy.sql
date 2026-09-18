-- Modelo de privacy_policy (gerado por scripts/sincronizar-modelo-legal.js).
-- O texto é o de docs/legal/. Campos da academia ficam como {{chave}} e são
-- preenchidos pelo admin no app; a substituição acontece ao publicar.
-- Marcadores: base_legal_saude, canal_contato, cnpj, encarregado, endereco, menores_de_idade, prazo_auditoria, prazo_backups, prazo_comprovantes, prazo_mensalidades, razao_social, regiao_cloudinary, transferencia_internacional

insert into public.legal_templates (kind, body)
values ('privacy_policy', $modelo$# Política de Privacidade

Esta política explica quais dados pessoais o aplicativo Snake Thai usa, para quê, com quem eles são compartilhados, por quanto tempo ficam guardados e como você exerce seus direitos pela Lei Geral de Proteção de Dados (Lei nº 13.709/2018, LGPD).

## 1. Quem cuida dos seus dados

O controlador dos dados é {{razao_social}}, CNPJ {{cnpj}}, com endereço em {{endereco}}.

Canal para assuntos de privacidade: {{canal_contato}}. Pessoa responsável pelo atendimento (encarregado): {{encarregado}}.

## 2. A quem esta política se aplica

A alunos, professores e administradores que usam o aplicativo.

## 3. Quais dados usamos

Cadastro:
- nome, CPF, celular e data de nascimento;
- e-mail de acesso e senha (a senha é guardada de forma irreversível, nem a academia consegue lê-la);
- turma, plano, situação da matrícula (ativa ou trancada) e papel no app (aluno, professor ou administrador);
- para professores, a cor usada para identificá-los nas aulas.

Mensalidades:
- valor, vencimento e situação de cada mensalidade;
- a imagem do comprovante de pagamento que você envia e o resultado da análise (aprovado ou recusado).

Aulas e frequência:
- presenças e faltas registradas na chamada e o resumo mensal de frequência;
- justificativas de falta que você envia (texto e, se quiser, um anexo) e o resultado da análise.

Segurança e registros:
- quando e por quem um cadastro, pagamento ou aula foi alterado (trilha de auditoria, que guarda só o que mudou);
- registros técnicos de acesso mantidos pelo provedor de autenticação, como data e hora de entrada e endereço IP;
- a versão desta política e dos Termos de Uso que você aceitou e quando.

Notificações (só se você ativar):
- um código do aparelho fornecido pelo Android para entregar avisos e o tipo de aparelho;
- o histórico dos avisos enviados.

Falhas do aplicativo:
- quando o app apresenta um erro, é enviado um relatório técnico com dados do aparelho (modelo, versão do sistema, idioma, fuso, memória e bateria), a versão do app, a parte do app em que o erro aconteceu, um código aleatório gerado na instalação e o papel da conta (aluno, professor ou administrador);
- esse código de instalação não identifica a sua conta: ele é sorteado no aparelho e não é o número do seu cadastro;
- o relatório não leva nome, CPF, e-mail, telefone, valores nem imagens.

No próprio aparelho:
- a sessão de acesso fica guardada cifrada;
- para professores, a chamada em andamento fica salva no aparelho até ser concluída, por no máximo 7 dias;
- o desbloqueio por digital é opcional e feito pelo próprio Android: o aplicativo nunca recebe nem guarda a sua digital.

O aplicativo não usa localização, contatos nem câmera. Da galeria e dos arquivos do aparelho, só é enviado o comprovante ou o anexo que você escolhe.

Dados de saúde: uma justificativa de falta pode conter informação de saúde, como um atestado. Ela é usada só para analisar a falta. Envie apenas o necessário.

## 4. Para que usamos e com qual base legal

Para prestar o serviço contratado, que é o de matrícula, aulas e mensalidades (LGPD, art. 7º, V):
- cadastrar você, organizar turmas, aulas e chamadas;
- gerar mensalidades, receber e analisar comprovantes;
- analisar justificativas de falta.

Para cumprir obrigações legais, como as regras fiscais e contábeis sobre registros de pagamento (art. 7º, II).

Por legítimo interesse da academia, sempre com o mínimo de dados (art. 7º, IX):
- proteger contas e registrar alterações (auditoria);
- corrigir falhas do aplicativo;
- acompanhar a frequência para que a academia possa entrar em contato com alunos que estão faltando muito. Essa indicação é só uma lista para a equipe: nenhuma decisão é tomada automaticamente.

Com o seu consentimento (art. 7º, I), que você pode retirar a qualquer momento no Perfil:
- notificações no celular;
- desbloqueio por digital.

Dado de saúde enviado numa justificativa: {{base_legal_saude}}.

Não vendemos seus dados, não os usamos para publicidade e não os compartilhamos com outras empresas para fins próprios delas.

## 5. Quem dentro da academia vê seus dados

- Administradores: todos os dados de cadastro, mensalidades, comprovantes, frequência e justificativas.
- Professores: o nome, a turma e a situação da matrícula dos alunos, para montar a chamada, e a frequência e as justificativas das aulas que conduzem. Professores não veem CPF, celular, data de nascimento, mensalidades nem comprovantes.
- Alunos: os próprios dados e o nome e a cor dos professores.

## 6. Empresas que processam dados para a academia

O aplicativo usa serviços de terceiros que processam dados em nome da academia, seguindo as instruções dela:
- Supabase: banco de dados, autenticação e funções do servidor. Dados armazenados nos Estados Unidos.
- Render: servidor que recebe as imagens de comprovante e de anexos. Estados Unidos.
- Cloudinary: armazenamento das imagens de comprovante e dos anexos de justificativa. {{regiao_cloudinary}}.
- Expo e Google (Firebase Cloud Messaging): entrega das notificações no celular. Recebem o código do aparelho e o texto do aviso, que não contém nome nem CPF. Estados Unidos.
- Sentry: relatórios de falha do aplicativo. Os relatórios ficam na União Europeia (Alemanha); a conta de acesso fica nos Estados Unidos.

Também podemos compartilhar dados com autoridades públicas quando a lei exigir.

## 7. Transferência internacional

Como parte desses serviços fica fora do Brasil, há transferência internacional de dados. Ela é feita {{transferencia_internacional}}.

## 8. Por quanto tempo guardamos

Enquanto a conta existir, os dados ficam guardados para prestar o serviço.

Quando a conta é excluída, na mesma hora:
- nome, CPF, celular, data de nascimento e e-mail são apagados ou substituídos por valores sem relação com você;
- as imagens de comprovante e os anexos de justificativa entram na fila de eliminação e são apagados do armazenamento;
- as justificativas de falta, os aparelhos cadastrados para notificação e os registros de aceite são apagados;
- o acesso é bloqueado e todas as sessões são encerradas.

Continuam guardados, sem identificar você:
- mensalidades (valores, vencimentos e situação), por {{prazo_mensalidades}};
- presenças e faltas, para as estatísticas da academia.

Outros prazos:
- imagens de comprovante de mensalidades pagas: {{prazo_comprovantes}};
- histórico de notificações: 30 dias;
- relatórios de falha do aplicativo: 30 dias;
- chamada em andamento no aparelho do professor: até 7 dias;
- trilha de auditoria: {{prazo_auditoria}};
- cópias de segurança do banco de dados: {{prazo_backups}}.

## 9. Seus direitos

Você pode, a qualquer momento:
- confirmar que tratamos seus dados e acessá-los: em Perfil, "Exportar meus dados" gera uma cópia dos seus dados;
- corrigir dados: em Perfil, "Meus dados" (nome e CPF são corrigidos pela academia);
- levar seus dados para outro serviço: a exportação vem em formato aberto (JSON);
- excluir a conta: em Perfil, "Excluir minha conta". Contas de administrador são excluídas por outro administrador;
- retirar o consentimento de notificações e digital: em Perfil;
- saber com quem compartilhamos dados: seção 6 desta política;
- pedir informações, se opor a um tratamento ou fazer qualquer outro pedido da LGPD pelo canal da seção 1;
- reclamar à Autoridade Nacional de Proteção de Dados (ANPD).

Pedidos feitos pelo canal da seção 1 são respondidos em até 15 dias.

## 10. Segurança

- Toda comunicação do aplicativo é cifrada (HTTPS).
- Cada pessoa só acessa os dados que o seu papel permite, com a regra aplicada no próprio banco de dados.
- A senha precisa ser forte e é trocada no primeiro acesso.
- Os registros de erro do aplicativo e do servidor de comprovantes são filtrados para não guardar dados pessoais.

Se acontecer um incidente de segurança que possa causar risco ou dano relevante, a academia avisará a ANPD e as pessoas afetadas, como manda a LGPD.

## 11. Crianças e adolescentes

{{menores_de_idade}}.

## 12. Mudanças nesta política

Quando esta política mudar, o aplicativo mostrará a nova versão e pedirá o seu aceite antes de continuar. As versões anteriores ficam guardadas. A versão vigente pode ser lida a qualquer momento em Perfil, "Termos e privacidade".
$modelo$)
on conflict (kind) do update set body = excluded.body, updated_at = now();
