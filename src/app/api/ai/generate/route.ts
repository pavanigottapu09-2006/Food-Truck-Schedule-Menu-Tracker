import { llmGenerate, type AiTask } from "@/lib/ai";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const task = (body.task || "menu-description") as AiTask;
  const input = (body.input || {}) as Record<string, string>;
  const result = await llmGenerate(task, input);
  return Response.json(result);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const task = (searchParams.get("task") || "daily-special") as AiTask;
  const input: Record<string, string> = {};
  searchParams.forEach((v, k) => {
    if (k !== "task") input[k] = v;
  });
  const result = await llmGenerate(task, input);
  return Response.json(result);
}
