import { NextRequest, NextResponse } from "next/server";

const GROQ_API_URL =
  "https://api.groq.com/openai/v1/chat/completions";

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error: "GROQ_API_KEY is missing",
        },
        { status: 500 }
      );
    }

    const body = await req.json();

    const messages = Array.isArray(body?.messages)
      ? body.messages
      : [];

    if (messages.length === 0) {
      return NextResponse.json(
        {
          error: "No messages were provided",
        },
        { status: 400 }
      );
    }

    const groqResponse = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        messages,
        temperature: 0.3,
        max_tokens: 4096,
      }),
    });

    const raw = await groqResponse.text();

    let data: any;

    try {
      data = JSON.parse(raw);
    } catch {
      data = { raw };
    }

    if (!groqResponse.ok) {
      console.error("GROQ ERROR:", {
        status: groqResponse.status,
        data,
      });

      return NextResponse.json(
        {
          error:
            data?.error?.message ||
            `Groq returned HTTP ${groqResponse.status}`,
          groqStatus: groqResponse.status,
          details: data,
        },
        {
          status: groqResponse.status,
        }
      );
    }

    const answer =
      data?.choices?.[0]?.message?.content;

    if (!answer) {
      return NextResponse.json(
        {
          error: "Groq returned successfully but contained no answer.",
          details: data,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      message: answer,
      content: answer,
      response: answer,
    });
  } catch (error) {
    console.error("API ROUTE ERROR:", error);

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
