import { NextRequest, NextResponse } from "next/server";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "openai/gpt-oss-120b";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const messages = Array.isArray(body.messages)
      ? body.messages
      : [];

    if (messages.length === 0) {
      return NextResponse.json(
        { error: "No messages provided." },
        { status: 400 }
      );
    }

    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "GROQ_API_KEY is missing from Vercel." },
        { status: 500 }
      );
    }

    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0.3,
        max_tokens: 4096,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Groq API error:", data);

      return NextResponse.json(
        {
          error:
            data?.error?.message ||
            `Groq API returned HTTP ${response.status}`,
        },
        { status: response.status }
      );
    }

    const answer =
      data?.choices?.[0]?.message?.content ||
      "I couldn't generate a response.";

    return NextResponse.json({
      message: answer,
      model: MODEL,
    });
  } catch (error) {
    console.error("Chat API error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unknown server error",
      },
      { status: 500 }
    );
  }
}
