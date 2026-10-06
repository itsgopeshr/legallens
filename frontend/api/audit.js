export default async function handler(req, res) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { base64Image } = req.body || {};
  if (!base64Image) {
    return res.status(400).json({ error: 'Missing base64Image payload' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured in Vercel.' });
  }

  const prompt = `
You are a senior enforcement officer under the Legal Metrology (Packaged Commodities) Rules, 2011 (PCR 2011) in India.
Analyze this packaging image and extract statutory declarations precisely:
1. Product/Brand Name (e.g., Glucon-D, Dettol).
2. Category: Exactly "food", "cosmetic", or "general".
3. Maximum Retail Price (MRP): Numerical value in Rupees (e.g., ₹435.00 or ₹99.00). Look for printed ink stamps, bottom flaps, or labels.
4. Net Quantity: Net weight or volume (e.g., "1 kg", "200 ml"). Do NOT confuse with serving sizes like "per serve 35g".
5. Declared Unit Sale Price (USP): As per G.S.R. 226(E) (e.g., ₹0.44/g or ₹0.50/ml).
6. Manufacturing / Packaging Date / Batch No.
7. Product Intelligence: A concise 2-sentence factual overview of the product, ingredients, and key legal declarations.

Return ONLY a valid JSON object matching this schema without markdown fences:
{
  "productName": "string",
  "category": "food" | "cosmetic" | "general",
  "mrp": "string with currency, e.g., ₹435.00, or null",
  "mrpValue": number or null,
  "netQuantity": "string, e.g., 1 kg, 200 ml, or null",
  "netQuantityValue": number or null,
  "netQuantityUnit": "string, e.g., g, ml, or null",
  "declaredUsp": "string or null",
  "mfgDate": "string or null",
  "violations": ["string list of missing or invalid declarations under PCR 2011"],
  "productIntelligence": "string summary"
}
`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { inlineData: { mimeType: 'image/jpeg', data: base64Image } }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json'
        }
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({ error: err.error?.message || `Google API error HTTP ${response.status}` });
    }

    const data = await response.json();
    const textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textOutput) {
      return res.status(502).json({ error: 'No output generated from Vision model.' });
    }

    return res.status(200).json(JSON.parse(textOutput));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
