// Built-in "AI" engine: heuristic generation that works offline,
// upgraded to a real LLM when OPENAI_API_KEY / AI_API_KEY is set.

export type AiTask =
  | "menu-description"
  | "daily-special"
  | "schedule-optimizer"
  | "marketing-blurb";

const ADJECTIVES = ["smoky", "zesty", "crispy", "creamy", "charred", "fresh", "bold", "savory"];
const FINISHERS = [
  "finished with fresh herbs and a squeeze of lime",
  "served hot with house-made sauce",
  "topped with crunchy slaw and pickled onions",
  "paired with a cooling dip",
  "garnished with toasted seeds",
];

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

export function localGenerate(task: AiTask, input: Record<string, string>): string {
  const seed = hash(JSON.stringify(input) + task);
  const name = input.name || input.dish || "Chef's Special";
  const cuisine = input.cuisine || "street food";
  const ingredients = input.ingredients || "fresh local ingredients";

  switch (task) {
    case "menu-description":
      return `${name}: ${pick(ADJECTIVES, seed)} ${cuisine} favorite made with ${ingredients}, ${pick(FINISHERS, seed + 1)}. A crowd-pleaser at $${input.price || "8.99"} — ${input.veg === "true" ? "100% vegetarian" : "protein-packed"}${input.spicy === "true" ? " with a spicy kick" : ""}.`;
    case "daily-special":
      return `🔥 Today's AI Special for ${input.truck || "your truck"}: "${name} Deluxe" — ${pick(ADJECTIVES, seed)} twist on a classic with ${ingredients}. Bundle it at $${input.price || "9.99"} with a drink to lift average order value ~18%. Promote 11am–2pm near ${input.location || "high foot-traffic zones"}.`;
    case "schedule-optimizer":
      return `📍 Schedule insight for ${input.truck || "fleet"}: ${input.location || "Downtown Plaza"} shows peak demand ${input.day || "Friday"} ${input.time || "11:30–14:00"}. Avoid overlapping ${input.other || "two trucks"} in the same zone — stagger by 45 min. Suggested slot: ${input.day || "Friday"} 17:00–21:00 at Night Market (+~22% revenue based on similar cuisines).`;
    case "marketing-blurb":
      return `🚚 ${input.truck || name} is rolling into ${input.location || "town"}! ${pick(ADJECTIVES, seed)} ${cuisine} ${pick(FINISHERS, seed)} — come hungry. Tag us & get 10% off ${name}. Open ${input.time || "11am–9pm"} today!`;
    default:
      return `Generated idea for ${name}.`;
  }
}

export async function llmGenerate(task: AiTask, input: Record<string, string>): Promise<{ text: string; source: "llm" | "local" }> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY || "";
  const base = process.env.AI_BASE_URL || "https://api.openai.com/v1";
  const model = process.env.AI_MODEL || "gpt-4o-mini";

  if (!apiKey) return { text: localGenerate(task, input), source: "local" };

  try {
    const prompt = `Task: ${task}. Context JSON: ${JSON.stringify(input)}. Write a concise, appetizing, food-truck-appropriate result in under 80 words.`;
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "You are a food-truck menu and operations copilot." },
          { role: "user", content: prompt },
        ],
        temperature: 0.8,
        max_tokens: 220,
      }),
    });
    if (!res.ok) throw new Error(`LLM ${res.status}`);
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content?.trim() || localGenerate(task, input);
    return { text, source: "llm" };
  } catch {
    return { text: localGenerate(task, input), source: "local" };
  }
}
