// Netlify Functions futási környezet: Node 18+
// A kliens NEM látja az API kulcsot — ez a biztonságos réteg.
export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { goal = "fogyas", prompt = "" } = JSON.parse(event.body || "{}");
    if (!prompt) {
      return { statusCode: 400, body: JSON.stringify({ error: "Hiányzó prompt" }) };
    }

    const goalLabel =
      goal === "szalkasitas" ? "szálkásítás" : goal === "hizas" ? "hízás" : "fogyás";

    const system = `
Te egy magyar nyelvű fitnesz-asszisztens vagy. 
Felhasználói cél: ${goalLabel}.
Irányelvek:
- Mindig magyarul válaszolj.
- Adj praktikus, lépésről-lépésre tippeket edzésre és étkezésre.
- Legyél kedves, motiváló, de óvatos: jelezd, hogy ez nem orvosi tanács.
- Ha kérnek tervet, adj 3-5 napos mintaedzést és 1 nap mintaétrendet (grammokkal).
- Ha makrókról kérdeznek, számolj a szokásos tartományokkal (fehérje 1.8–2.2 g/kg, zsír 0.8–1.0 g/kg).`;

    // OpenAI Responses API (összeegyeztethető a GPT-4o-mini jellegű modellekkel)
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ error: "Hiányzó OPENAI_API_KEY" }) };
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        input: [
          { role: "system", content: system },
          { role: "user", content: prompt }
        ],
        temperature: 0.6,
        max_output_tokens: 600
      })
    });

    if (!response.ok) {
      const txt = await response.text();
      return { statusCode: response.status, body: JSON.stringify({ error: txt }) };
    }

    const json = await response.json();
    // A Responses API egységes "output_text" mezőt biztosíthat; 
    // ha nem, akkor illesztünk fallbacket.
    const reply =
      json.output_text ||
      json.choices?.[0]?.message?.content ||
      json.data?.[0]?.content?.[0]?.text ||
      "Szia! Hogyan segíthetek a célodban?";

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reply })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
}
