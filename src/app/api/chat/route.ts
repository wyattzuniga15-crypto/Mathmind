import { NextRequest, NextResponse } from "next/server";

const GROQ_API_URL =
  "https://api.groq.com/openai/v1/chat/completions";

// Use a current Groq model
const MODEL = "llama-3.3-70b-versatile";

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "GROQ_API_KEY is not configured." },
        { status: 500 }
      );
    }

    const body = await req.json();

    if (!body || !Array.isArray(body.messages)) {
      return NextResponse.json(
        { error: "messages must be an array." },
        { status: 400 }
      );
    }

    // Only send valid chat messages to Groq
    const messages = body.messages
      .filter(
        (m: any) =>
          m &&
          typeof m.content === "string" &&
          ["user", "assistant", "system"].includes(m.role)
      )
      .map((m: any) => ({
        role: m.role,
        content: m.content,
      }));

    if (messages.length === 0) {
      return NextResponse.json(
        { error: "No valid messages were provided." },
        { status: 400 }
      );
    }

    console.log("Sending request to Groq:", {
      model: MODEL,
      messageCount: messages.length,
    });

    const groqResponse = await fetch(GROQ_API_URL, {
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

    const data = await groqResponse.json();

    if (!groqResponse.ok) {
      console.error("Groq error:", data);

      return NextResponse.json(
        {
          error:
            data?.error?.message ||
            `Groq returned HTTP ${groqResponse.status}`,
        },
        { status: groqResponse.status }
      );
    }

    const answer = data?.choices?.[0]?.message?.content;

    if (!answer) {
      console.error("Unexpected Groq response:", data);

      return NextResponse.json(
        { error: "Groq returned no message." },
        { status: 502 }
      );
    }

    console.log("Groq response received successfully.");

    // Return several common names so your frontend can use whichever
    // one it expects.
    return NextResponse.json({
      message: answer,
      content: answer,
      response: answer,
      model: MODEL,
    });
  } catch (error) {
    console.error("Chat route error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Internal server error.",
      },
      { status: 500 }
    );
  }
}
