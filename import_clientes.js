const API = 'https://renewed-youth-production-7d32.up.railway.app/api/v1';

const clientes = [
  { clientName: 'Juliana Costa - Aya Fit', clientEmail: 'juliana-kd@hotmail.com', clientPhone: '85986962001', serviceType: 'SOCIAL_MEDIA', monthlyValue: 1600, totalValue: 19200, installments: 1, signedAt: '2026-04-05', startsAt: '2026-04-05', notes: 'Rede Social · Vence Dia 5 · 3 meses' },
  { clientName: 'Jorge José - Liz', clientEmail: 'contato.sejaliz@gmail.com', clientPhone: '85996447767', serviceType: 'PAID_TRAFFIC', monthlyValue: 1500, totalValue: 9000, installments: 1, signedAt: '2026-04-05', startsAt: '2026-04-05', notes: 'Tráfego Pago · Vence Dia 5 · 6 meses' },
  { clientName: 'Yasnara - Naromo (Redes)', clientEmail: 'yasnara@napaiva.com', clientPhone: '85997375037', serviceType: 'SOCIAL_MEDIA', monthlyValue: 2000, totalValue: 24000, installments: 1, signedAt: '2025-10-24', startsAt: '2025-10-24', notes: 'Rede Social · Vence Dia 7 · 12 meses' },
  { clientName: 'Yasnara - Naromo (Tráfego)', clientEmail: 'yasnara@napaiva.com', clientPhone: '85997375037', serviceType: 'PAID_TRAFFIC', monthlyValue: 1000, totalValue: 12000, installments: 1, signedAt: '2025-10-24', startsAt: '2025-10-24', notes: 'Tráfego Pago · Vence Dia 27 · 12 meses' },
  { clientName: 'Yasnara - Nara Paiva (Tráfego)', clientEmail: 'yasnara@napaiva.com', clientPhone: '85997375037', serviceType: 'PAID_TRAFFIC', monthlyValue: 1500, totalValue: 18000, installments: 1, signedAt: '2025-10-24', startsAt: '2025-10-24', notes: 'Tráfego Pago · Vence Dia 17 · 12 meses' },
  { clientName: 'Sthephanie - Shopcast', clientEmail: 'contato.shopcast@gmail.com', clientPhone: '85999198447', serviceType: 'PAID_TRAFFIC', monthlyValue: 1500, totalValue: 18000, installments: 1, signedAt: '2025-10-22', startsAt: '2025-10-22', notes: 'Tráfego Pago · Vence Dia 20 · 12 meses' },
  { clientName: 'Henrique - Liberty Jeans', clientEmail: 'libertyjeansoficial@gmail.com', clientPhone: '85999333869', serviceType: 'PAID_TRAFFIC', monthlyValue: 1000, totalValue: 6000, installments: 1, signedAt: '2025-10-16', startsAt: '2025-10-16', notes: 'Tráfego Pago · Vence Dia 15 · 6 meses' },
  { clientName: 'Imaculada - Nina e Noz', clientEmail: 'imaculadapiressgt@gmail.com', clientPhone: '85997842654', serviceType: 'SOCIAL_MEDIA', monthlyValue: 2000, totalValue: 24000, installments: 1, signedAt: '2025-10-14', startsAt: '2025-10-14', notes: 'Rede Social · Vence Dia 15 · 12 meses' },
  { clientName: 'Luiz Gonzaga - Sun Liv', clientEmail: 'sunlivgoiania@hotmail.com', clientPhone: '85991621538', serviceType: 'OTHER', monthlyValue: 1500, totalValue: 18000, installments: 1, signedAt: '2025-03-06', startsAt: '2025-03-06', notes: 'Marketing 360 · Vence Dia 10 · 12 meses' },
  { clientName: 'Joseni Cruz - Doce Caju', clientEmail: 'josenny_cruz@hotmail.com', clientPhone: '85985307764', serviceType: 'SOCIAL_MEDIA', monthlyValue: 3230, totalValue: 38760, installments: 1, signedAt: '2024-08-23', startsAt: '2024-08-23', notes: 'Redes + Tráfego · Vence Dia 30 · 12 meses' },
  { clientName: 'Sergio Pedrosa - Andirá Jeans', clientEmail: 'andiradenin@gmail.com', clientPhone: '81999296023', serviceType: 'SOCIAL_MEDIA', monthlyValue: 4000, totalValue: 48000, installments: 1, signedAt: '2024-07-15', startsAt: '2024-07-15', notes: 'Redes + Tráfego · Vence Dia 20 · 12 meses' },
  { clientName: 'Beatriz - Del Carmen by Saruc', clientEmail: 'botelhos.beatriz@gmail.com', clientPhone: '11993674765', serviceType: 'SOCIAL_MEDIA', monthlyValue: 3760, totalValue: 45120, installments: 1, signedAt: '2024-07-05', startsAt: '2024-07-05', notes: 'Redes + Tráfego · Vence Dia 10 · 12 meses' },
  { clientName: 'Maria Hilda - Use Rothes', clientEmail: 'mariahildasil55@gmail.com', clientPhone: '85991246112', serviceType: 'PAID_TRAFFIC', monthlyValue: 1000, totalValue: 12000, installments: 1, signedAt: '2024-07-25', startsAt: '2024-07-25', notes: 'Tráfego Pago · Vence Dia 5 · 12 meses' },
  { clientName: 'Irandra - Eloah', clientEmail: 'juju.soares@bol.com.br', clientPhone: '85996833834', serviceType: 'SOCIAL_MEDIA', monthlyValue: 3000, totalValue: 36000, installments: 1, signedAt: '2024-02-22', startsAt: '2024-02-22', notes: 'Redes + Tráfego · Vence Dia 5 · 12 meses' },
  { clientName: 'Rafaela - Amo Frozinha', clientEmail: 'frozinhaamo@gmail.com', clientPhone: '85999336570', serviceType: 'PAID_TRAFFIC', monthlyValue: 1200, totalValue: 14400, installments: 1, signedAt: '2023-04-05', startsAt: '2023-04-05', notes: 'Tráfego Pago · Vence Dia 5 · 12 meses' },
  { clientName: 'Michelle - Amiche', clientEmail: 'usoamiche@gmail.com', clientPhone: '85981160721', serviceType: 'SOCIAL_MEDIA', monthlyValue: 3300, totalValue: 39600, installments: 1, signedAt: '2026-03-05', startsAt: '2026-03-05', notes: 'Redes + Tráfego · Vence Dia 15 · 12 meses · Multa rescisão' },
  { clientName: 'Luis Fellype - Kyrefh', clientEmail: 'adj905@hotmail.com', clientPhone: '85988769020', serviceType: 'SOCIAL_MEDIA', monthlyValue: 3300, totalValue: 39600, installments: 1, signedAt: '2022-02-05', startsAt: '2022-02-05', notes: 'Redes + Tráfego + CRM · Vence Dia 5 · 12 meses' },
  { clientName: 'Samuel - Marry Blue', clientEmail: 'samo_ka@hotmail.com', clientPhone: '85981532689', serviceType: 'SOCIAL_MEDIA', monthlyValue: 1000, totalValue: 12000, installments: 1, signedAt: '2023-02-15', startsAt: '2023-02-15', notes: 'Rede Social · Vence Dia 25 · 12 meses' },
  { clientName: 'Mariana - Flora Minha', clientEmail: 'floraminha@hotmail.com', clientPhone: '85999252998', serviceType: 'SOCIAL_MEDIA', monthlyValue: 2562.20, totalValue: 30746.40, installments: 1, signedAt: '2021-05-24', startsAt: '2021-05-24', notes: 'Redes + Tráfego · Vence Dia 20 · 12 meses' },
  { clientName: 'Camila - Tchubi', clientEmail: 'tchu.bi@outlook.com.br', clientPhone: '85985263312', serviceType: 'SOCIAL_MEDIA', monthlyValue: 2340, totalValue: 14040, installments: 1, signedAt: '2026-01-16', startsAt: '2026-01-16', endsAt: '2026-07-16', notes: 'Redes Sociais · Vence Dia 20 · 6 meses' },
  { clientName: 'Bruna - Santa Passion', clientEmail: 'marketing@santapassion.com.br', clientPhone: '85987176006', serviceType: 'SOCIAL_MEDIA', monthlyValue: 1200, totalValue: 14400, installments: 1, signedAt: '2026-04-24', startsAt: '2026-04-24', notes: 'Redes + Conteúdo · Vence Dia 24 · 12 meses' },
  { clientName: 'CleanGirl - Aeris Wear', clientEmail: 'beatriz@saros-group.com', clientPhone: '11917779792', serviceType: 'PAID_TRAFFIC', monthlyValue: 1650, totalValue: 19800, installments: 1, signedAt: '2026-01-01', startsAt: '2026-01-01', notes: 'Tráfego Pago · Vence Dia 20 · 12 meses' },
  { clientName: 'Jenni Pink', clientEmail: 'jennipiink@gmail.com', clientPhone: '85984743868', serviceType: 'SOCIAL_MEDIA', monthlyValue: 2500, totalValue: 15000, installments: 1, signedAt: '2026-01-01', startsAt: '2026-01-01', notes: 'Redes + Creators · Vence Dia 20 · 6 meses' },
  { clientName: 'Mandi Confecções', clientEmail: 'contato@soumandi.com.br', clientPhone: '71997010984', serviceType: 'SOCIAL_MEDIA', monthlyValue: 2500, totalValue: 15000, installments: 1, signedAt: '2026-04-30', startsAt: '2026-04-30', notes: 'Redes + Creators · Vence Dia 30 · 6 meses' },
  { clientName: 'CRM Amiche', clientEmail: 'usoamiche@gmail.com', clientPhone: '85981160721', serviceType: 'CRM_SETUP', monthlyValue: 333.33, totalValue: 2000, installments: 6, installmentsPaid: 0, signedAt: '2026-03-05', startsAt: '2026-03-05', notes: 'Implantação CRM · 6 parcelas de R$333 · Comissão Kommo inclusa' },
  { clientName: 'CRM Adanna', clientEmail: '', clientPhone: '', serviceType: 'CRM_SETUP', monthlyValue: 200, totalValue: 1000, installments: 5, installmentsPaid: 3, signedAt: '2026-01-30', startsAt: '2026-01-30', endsAt: '2026-06-30', notes: 'Implantação CRM · 5 parcelas de R$200 · 3 pagas · termina Jun/26' },
];

async function login() {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'suporte@duacriativa.com', password: 'dua@2026' }),
  });
  const data = await res.json();
  return data.accessToken;
}

async function importar() {
  console.log('Fazendo login...');
  const token = await login();
  if (!token) { console.error('Login falhou'); return; }
  console.log('Login OK. Importando', clientes.length, 'contratos...\n');

  let ok = 0, err = 0;
  for (const c of clientes) {
    const res = await fetch(`${API}/contracts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(c),
    });
    if (res.ok) {
      console.log('✅', c.clientName);
      ok++;
    } else {
      const e = await res.text();
      console.log('❌', c.clientName, '—', e.slice(0, 100));
      err++;
    }
  }
  console.log(`\nConcluído: ${ok} importados, ${err} erros`);
}

importar();
