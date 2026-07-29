// api/send-report.js
// Vercel Serverless Function — roda automaticamente quando o front-end
// faz POST pra /api/send-report. Gera o PDF, salva o lead no Supabase
// e dispara o e-mail com o relatório anexado — tudo em uma chamada.

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

// ==== VARIÁVEIS DE AMBIENTE (configurar no painel da Vercel) ====
// RESEND_API_KEY        -> pega grátis em resend.com (até 3000 e-mails/mês)
// SUPABASE_URL          -> mesmo projeto do GrowthOS ou um novo
// SUPABASE_SERVICE_KEY  -> service_role key (Settings > API no Supabase)
// FROM_EMAIL             -> ex: "AI Applied <diagnostico@seudominio.com>"
//                            (precisa verificar o domínio no Resend, grátis)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, answers } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'E-mail inválido' });
    }

    // 1) CALCULAR SCORE E VALOR EM RISCO (mesma lógica do front-end)
    const scores = calcScores(answers);
    const revenueAtRisk = calcRevenueAtRisk(answers);

    // 2) GERAR O PDF
    const pdfBytes = await buildPdf({ email, answers, scores, revenueAtRisk });

    // 3) SALVAR O LEAD NO SUPABASE
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
      await supabase.from('diagnosticos_ri').insert([{
        email,
        respostas: answers,
        score_atribuicao: scores.attr,
        score_arquitetura: scores.arch,
        score_lifecycle: scores.life,
        receita_em_risco: revenueAtRisk,
        criado_em: new Date().toISOString()
      }]);
    }

    // 4) ENVIAR O E-MAIL COM O PDF ANEXADO
    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: process.env.FROM_EMAIL || 'AI Applied <onboarding@resend.dev>',
        to: email,
        subject: 'Seu Relatório de Revenue Intelligence',
        html: `<p>Segue em anexo o relatório completo da sua análise.</p>
               <p>Se quiser aprofundar, você pode agendar uma Análise de Arquitetura diretamente com a AI Applied.</p>`,
        attachments: [{
          filename: 'diagnostico-revenue-intelligence.pdf',
          content: Buffer.from(pdfBytes).toString('base64')
        }]
      });

      // Notificação rápida pra você mesmo, sempre que alguém completar o diagnóstico
      if (process.env.NOTIFY_EMAIL) {
        try {
          await resend.emails.send({
            from: process.env.FROM_EMAIL || 'AI Applied <onboarding@resend.dev>',
            to: process.env.NOTIFY_EMAIL,
            subject: `Novo Diagnóstico: ${email}`,
            html: `<p>Novo lead completou o Diagnóstico de Revenue Intelligence.</p>
                   <p><b>E-mail:</b> ${email}</p>
                   <p><b>Receita em risco estimada:</b> R$ ${Math.round(revenueAtRisk).toLocaleString('pt-BR')}</p>
                   <p><b>Scores:</b> Atribuição ${scores.attr} · Arquitetura ${scores.arch} · Lifecycle ${scores.life}</p>`
          });
        } catch (notifyErr) {
          // Falha na notificação não deve travar o envio pro lead
          console.error('Erro ao notificar:', notifyErr);
        }
      }
    }

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error('Erro em send-report:', err);
    return res.status(500).json({ error: 'Falha ao processar. Tente novamente.' });
  }
}

// ---------- lógica de cálculo (espelha o front-end) ----------
function calcScores(answers) {
  const attrMap = { sim: 90, parcial: 50, nao: 15 };
  const archMap = { integrado: 90, parcial: 50, manual: 15 };
  const lifeMap = { sim: 90, manual: 45, nao: 15 };
  return {
    attr: attrMap[answers.q5] ?? 0,
    arch: archMap[answers.q6] ?? 0,
    life: lifeMap[answers.q7] ?? 0
  };
}

function calcRevenueAtRisk(answers) {
  const faturamentoMensal = (Number(answers.q2) || 0) * ((Number(answers.q3) || 0) / 100) * (Number(answers.q4) || 0);
  const faturamentoAnual = faturamentoMensal * 12;
  const attrFactor = { sim: 0.05, parcial: 0.35, nao: 0.6 }[answers.q5] ?? 0;
  const lifeFactor = { sim: 0.05, manual: 0.30, nao: 0.5 }[answers.q7] ?? 0;
  const receitaNaoAtribuida = faturamentoAnual * attrFactor;
  const receitaLatente = faturamentoAnual * lifeFactor * 0.4;
  return receitaNaoAtribuida + receitaLatente;
}

// ---------- geração do PDF ----------
async function buildPdf({ email, answers, scores, revenueAtRisk }) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const font = await doc.embedFont(StandardFonts.Helvetica);

  const navy = rgb(0.043, 0.071, 0.125);
  const terracota = rgb(0.757, 0.322, 0.122);
  const cream = rgb(0.957, 0.937, 0.902);

  // fundo navy no topo
  page.drawRectangle({ x: 0, y: 740, width: 595, height: 102, color: navy });
  page.drawText('AI APPLIED', { x: 40, y: 800, size: 12, font: fontBold, color: terracota });
  page.drawText('Diagnóstico de Revenue Intelligence', { x: 40, y: 770, size: 20, font: fontBold, color: cream });

  let y = 700;
  const line = (text, opts = {}) => {
    page.drawText(text, { x: 40, y, size: opts.size || 12, font: opts.bold ? fontBold : font, color: rgb(0.1, 0.1, 0.1) });
    y -= opts.gap || 22;
  };

  line(`Relatório gerado para: ${email}`, { bold: true, size: 13 });
  y -= 10;

  const brl = (v) => `R$ ${Math.round(v).toLocaleString('pt-BR')}`;
  line(`Receita fora de controle estimada: ${brl(revenueAtRisk)}`, { bold: true, size: 15, gap: 30 });

  line('Scores por dimensão:', { bold: true });
  line(`  Atribuição: ${scores.attr}/100`);
  line(`  Arquitetura de Dados: ${scores.arch}/100`);
  line(`  Lifecycle / Expansão: ${scores.life}/100`, { gap: 34 });

  line('Resumo da análise:', { bold: true });
  const wrapText = [
    'A análise identificou uma fragmentação de contexto entre marketing,',
    'comercial e operação. Enquanto cada área decide com uma versão',
    'diferente da realidade, parte do potencial de crescimento permanece',
    'invisível — o que se reflete diretamente na receita estimada acima.'
  ];
  wrapText.forEach(l => line(l, { size: 11, gap: 16 }));

  y -= 20;
  line('AI Applied Holding — Auditoria e Engenharia de Sistemas', { size: 10, gap: 14 });
  line('aiapplied.com.br', { size: 10 });

  return doc.save();
}
