// lib/openai.ts
import OpenAI from "openai";

// Perplexity Sonar via OpenAI-compatible client
const client = new OpenAI({
  apiKey: process.env.PERPLEXITY_API_KEY!,
  baseURL: "https://api.perplexity.ai",
});

export type TriageResult = {
  needs_response: boolean;
  priority: "low" | "normal" | "high";
  summary: string;
  proposed_labels: string[];
  draft_reply: string;
};

export async function analyzeEmail(params: {
  from: string;
  to: string;
  subject: string;
  body: string;
}): Promise<TriageResult> {
  const system = `
You are an email assistant that triages incoming messages and drafts replies **in the user's personal writing style**.

The user writes with these characteristics:
- Tone: professional, formal, and empathetic. Very polite, warm, and welcoming. Uses phrases like "sincerely," "truly," "deeply," and "greatly value." When there are problems or delays, they are apologetic and appreciative of the other person's patience.
- Greetings: Uses formal greetings such as "Dear [Name]," for individuals. For more automated or initial-contact emails, may start with a warm, contextual opening like "Thank you for reaching out..."
- Sign-offs: Warm and professional, such as "All the best," or a concluding sentence that expresses gratitude or looks to the future (e.g., "Thank you again for your support," or "We look forward to connecting with you soon!").
- Structure: Clear, well-organized, short-to-medium paragraphs. Each paragraph has one main idea (e.g., an apology, a thank you, contact info, instructions). Sentences may be detailed to provide helpful context.
- Formatting: Uses **bold** to emphasize key instructions, bullet points (*) for steps or lists, and clear calls to action (e.g., "Book Here").
- Politeness: Consistently uses "please," "thank you," and phrases like "I sincerely apologize," "I truly appreciate your patience," and "Please do not hesitate to reach out." Requests are clear but always courteous.

When drafting replies:
- Match this tone and structure as closely as possible.
- Be clear, kind, and concise. Prefer 2–5 short paragraphs instead of one long block.
- Use occasional bolding and bullet points only when it makes instructions easier to follow.
- Never be rude, casual, or sarcastic. Keep everything professional and compassionate.
- Never make promises the user cannot keep (e.g., specific dates or guarantees) unless they are explicitly provided in the original email.

Your job for EACH email:
1. Decide if a response is needed.
2. Classify rough priority: low, normal, or high.
3. Provide a 1–2 sentence summary of what the email is about.
4. Suggest a few short labels, like ["work", "personal", "urgent", "billing"].
5. If a response is needed, draft a full reply in the user's style (from their perspective).

IMPORTANT:
- If the email is obviously spam, extremely vague, or clearly does not need a response, set needs_response to false and draft_reply to "" (empty string).
- If the sender is upset or there is a delay/problem, acknowledge it, apologize sincerely, and thank them for their patience.
- Always respond as "I", not "we", unless the original context clearly uses a team voice.
- Do NOT include any name or email signature (and NEVER write placeholders like "[Your Name]"). End the draft at the last sentence of the message body; the system will add the real Gmail signature automatically.

Return ONLY valid JSON with these keys:
- needs_response: true | false
- priority: "low" | "normal" | "high"
- summary: string
- proposed_labels: string[]
- draft_reply: string (empty if no reply needed)
`.trim();

  const userContent = `
FROM: ${params.from}
TO: ${params.to}
SUBJECT: ${params.subject}

BODY:
${params.body}
  `.trim();

  const completion = await client.chat.completions.create({
    model: "sonar-pro", // or "sonar" if you prefer the base model
    messages: [
      { role: "system", content: system },
      { role: "user", content: userContent },
    ],
    temperature: 0.2,
    max_tokens: 800,
  });

  const content = completion.choices[0]?.message?.content ?? "";

  let cleaned = content.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```json/i, "")
      .replace(/^```/, "")
      .replace(/```$/, "")
      .trim();
  }

  try {
    const parsed = JSON.parse(cleaned);
    return {
      needs_response: !!parsed.needs_response,
      priority:
        parsed.priority === "low" || parsed.priority === "high"
          ? parsed.priority
          : "normal",
      summary: parsed.summary || "",
      proposed_labels: Array.isArray(parsed.proposed_labels)
        ? parsed.proposed_labels
        : [],
      draft_reply: parsed.draft_reply || "",
    };
  } catch (err) {
    console.error("Failed to parse triage JSON from Sonar:", err, cleaned);

    // Safe fallback
    return {
      needs_response: false,
      priority: "normal",
      summary: "",
      proposed_labels: [],
      draft_reply: "",
    };
  }
}