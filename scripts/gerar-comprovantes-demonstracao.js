#!/usr/bin/env node
/**
 * Comprovantes de demonstração para os pagamentos que aguardam aprovação.
 *
 * Na apresentação, o administrador abre um comprovante para aprovar. Sem
 * arquivo, a tela mostra erro e a demonstração morre bem no passo mais
 * importante do fluxo financeiro.
 *
 * Os arquivos vão para o Storage do Supabase, e não para a Cloudinary: assim
 * não é preciso credencial de terceiros nem o backend próprio no ar. O app
 * sabe ler os dois — `proof_provider` é quem decide.
 *
 *   node scripts/gerar-comprovantes-demonstracao.js
 *
 * Usa SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY do ambiente. Sem elas, cai no
 * banco local.
 *
 * ⚠️ SÓ EM BANCO DE DEMONSTRAÇÃO: inventa comprovante de pagamento.
 */
'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BUCKET = 'payment_proofs';

/** Desenha o comprovante com Python/PIL e devolve o PNG em memória. */
function desenharComprovante({ nome, valor, quando, transacao }) {
  const script = `
import io, sys
from PIL import Image, ImageDraw, ImageFont

def fonte(tamanho, negrito=False):
    # Fonte do sistema: a padrão do PIL é minúscula e ilegível numa projeção.
    for caminho in (r'C:\Windows\Fonts\arialbd.ttf' if negrito else r'C:\Windows\Fonts\arial.ttf',
                    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'):
        try:
            return ImageFont.truetype(caminho, tamanho)
        except OSError:
            continue
    return ImageFont.load_default()

L, A = 900, 1200
img = Image.new('RGB', (L, A), '#FFFFFF')
d = ImageDraw.Draw(img)

d.rectangle([0, 0, L, 170], fill='#0D0D0D')
d.text((48, 48), 'COMPROVANTE PIX', fill='#39FF14', font=fonte(38, True))
d.text((48, 100), 'Transferencia concluida', fill='#A1A1AA', font=fonte(22))

y = 235
def linha(rotulo, valor, tamanho=30, cor='#0D0D0D'):
    global y
    d.text((48, y), rotulo, fill='#71717A', font=fonte(18))
    d.text((48, y + 30), valor, fill=cor, font=fonte(tamanho, True))
    y += 108

linha('VALOR', 'R$ ${valor}', 46, '#15803D')
linha('DATA E HORA', '${quando}')
linha('PAGADOR', '${nome}')
linha('RECEBEDOR', 'Academia Snake Thai')
linha('CHAVE PIX DO RECEBEDOR', '12.345.678/0001-90', 26)
linha('ID DA TRANSACAO', '${transacao}', 20)

d.rectangle([48, y + 10, L - 48, y + 13], fill='#E4E4E7')
d.text((48, y + 46), 'Documento gerado para demonstracao do produto.', fill='#B45309', font=fonte(20, True))
d.text((48, y + 76), 'Nao corresponde a uma transacao bancaria real.', fill='#B45309', font=fonte(20))

saida = io.BytesIO()
img.save(saida, 'PNG')
sys.stdout.buffer.write(saida.getvalue())
`;
  return execFileSync('python', ['-c', script], { maxBuffer: 10 * 1024 * 1024, shell: false });
}

async function main() {
  const url = process.env.SUPABASE_URL ?? 'http://localhost:55321';
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY ?? lerChaveLocal();
  if (!chave) {
    console.error('Falta SUPABASE_SERVICE_ROLE_KEY (ou o banco local no ar).');
    process.exit(1);
  }

  const cabecalhos = { apikey: chave, Authorization: `Bearer ${chave}` };

  const resposta = await fetch(
    `${url}/rest/v1/payments?status=eq.pending_approval&proof_storage_path=is.null&select=id,user_id,amount_cents,due_date`,
    { headers: cabecalhos },
  );
  const pagamentos = await resposta.json();
  if (!Array.isArray(pagamentos) || pagamentos.length === 0) {
    console.log('Nenhum pagamento aguardando aprovação sem comprovante. Nada a fazer.');
    return;
  }

  console.log(`${pagamentos.length} pagamento(s) para gerar comprovante.`);

  for (const pagamento of pagamentos) {
    const perfil = await (
      await fetch(`${url}/rest/v1/profiles?id=eq.${pagamento.user_id}&select=name`, {
        headers: cabecalhos,
      })
    ).json();
    const nome = perfil?.[0]?.name ?? 'Aluno';
    const valor = (pagamento.amount_cents / 100).toFixed(2).replace('.', ',');
    const vencimento = new Date(`${pagamento.due_date}T12:00:00Z`);
    const quando = vencimento.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    const transacao = `E${String(pagamento.id).replace(/-/g, '').slice(0, 24).toUpperCase()}`;

    const png = desenharComprovante({ nome, valor, quando, transacao });

    // O caminho segue o formato do app: uma pasta por aluno.
    const caminho = `${pagamento.user_id}/demonstracao-${pagamento.id}.png`;
    const envio = await fetch(`${url}/storage/v1/object/${BUCKET}/${caminho}`, {
      method: 'POST',
      headers: { ...cabecalhos, 'Content-Type': 'image/png', 'x-upsert': 'true' },
      body: png,
    });
    if (!envio.ok) {
      console.error(`  falhou ao enviar ${caminho}: ${envio.status} ${await envio.text()}`);
      continue;
    }

    const gravado = await fetch(`${url}/rest/v1/payments?id=eq.${pagamento.id}`, {
      method: 'PATCH',
      headers: { ...cabecalhos, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({
        proof_provider: 'supabase_storage',
        proof_storage_path: caminho,
      }),
    });
    console.log(gravado.ok ? `  ok  ${nome} — R$ ${valor}` : `  erro ao gravar ${pagamento.id}`);
  }
}

/** Chave de serviço do banco local, lida do `supabase status`. */
function lerChaveLocal() {
  try {
    // shell: true porque no Windows o npx é um .cmd — sem isso, ENOENT.
    const saida = execFileSync('npx', ['--no-install', 'supabase', 'status', '-o', 'json'], {
      encoding: 'utf8',
      cwd: path.join(__dirname, '..'),
      shell: true,
    });
    // A CLI escreve avisos antes do JSON ("Stopped services: ..."), então
    // recortamos a partir da primeira chave — senão o parse morre.
    const inicio = saida.indexOf('{');
    return inicio === -1 ? '' : JSON.parse(saida.slice(inicio)).SERVICE_ROLE_KEY ?? '';
  } catch {
    return '';
  }
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
