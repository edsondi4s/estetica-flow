import dotenv from 'dotenv';
dotenv.config();

async function testWebhook() {
  const url = `${process.env.VITE_SUPABASE_URL}/functions/v1/ai_agent_webhook_v28`;
  const payload = {
    instance: "precommit", // Nome da instância obtido no log
    data: {
      key: {
        remoteJid: "559291571034@s.whatsapp.net",
        fromMe: false
      },
      message: {
        conversation: "Quero agendar uma limpeza de pele para amanhã às 10:00"
      },
      pushName: "Teste"
    }
  };

  console.log('Enviando payload para o webhook:', url);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.VITE_SUPABASE_ANON_KEY!
      },
      body: JSON.stringify(payload)
    });

    const text = await res.text();
    console.log('Status code:', res.status);
    console.log('Response body:', text);
  } catch (e: any) {
    console.error('Erro na requisição:', e.message);
  }
}

testWebhook();
