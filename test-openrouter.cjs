const url = 'https://openrouter.ai/api/v1/chat/completions';
const options = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer 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'
  },
  body: JSON.stringify({
    model: 'arcee-ai/trinity-large-preview:free',
    messages: [{ role: 'user', content: 'Olá, bom dia' }]
  })
};

fetch(url, options)
  .then(res => res.json())
  .then(json => console.log("RESPONSE EXACT STRING:\n" + json.choices[0].message.content))
  .catch(err => console.error(err));
