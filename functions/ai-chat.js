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
Mindig magyarul válaszolj, adj praktikus, motiváló tanácsokat.
`;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("❌ OPENAI_API_KEY nincs beállítva!");
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
        max_output_tokens: 500
      })
    });

    const text = await response.text();
    console.log("🔎 OpenAI raw response:", text);

    if (!response.ok) {
      return { statusCode: response.status, body: JSON.stringify({ error: text }) };
    }

    const json = JSON.parse(text);

    // próbáljunk több mezőt
    const reply =
      json.output_text ||
      json.output?.[0]?.content?.[0]?.text ||
      json.choices?.[0]?.message?.content ||
      "⚠️ Nem jött értelmezhető válasz.";

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reply })
    };
  } catch (err) {
    console.error("❌ Function error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
}
