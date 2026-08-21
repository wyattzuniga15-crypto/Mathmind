import { NextRequest, NextResponse } from "next/server";

const GROQ_API_URL =
  "https://api.groq.com/openai/v1/chat/completions";

const DEFAULT_MODEL = "openai/gpt-oss-20b";

export async function POST(req: NextRequest) {
  try {
    // Read request
    const body = await req.json();

    const messages = Array.isArray(body?.messages)
      ? body.messages
      : [];

    if (messages.length === 0) {
      return NextResponse.json(
        { error: "No messages provided." },
        { status: 400 }
      );
    }

    // Get API key from Vercel
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      console.error("GROQ_API_KEY is missing");

      return NextResponse.json(
        {
          error:
            "GROQ_API_KEY is missing. Add it in Vercel Environment Variables.",
        },
        { status: 500 }
      );
    }

    // Use Vercel variable if present
    const model =
      process.env.GROQ_MODEL || DEFAULT_MODEL;

    console.log("Using Groq model:", model);

    // Send request to Groq
    const response = await fetch(GROQ_API_URL, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },

      body: JSON.stringify({
        model,

        messages,

        temperature: 0.3,

        // Keep this relatively low so you don't
        // burn through Groq's TPM limit.
        max_tokens: 2048,

        stream: false,
      }),
    });

    // Safely read response
    const data = await response.json();

    // Groq returned an error
    if (!response.ok) {
      console.error(
        "Groq API error:",
        response.status,
        data
      );

      const errorMessage =
        data?.error?.message ||
        data?.error ||
        `Groq API returned HTTP ${response.status}`;

      return NextResponse.json(
        {
          error: errorMessage,
          status: response.status,
          model,
        },
        {
          status: response.status,
        }
      );
    }

    // Get assistant response
    const answer =
      data?.choices?.[0]?.message?.content;

    if (!answer) {
      console.error(
        "Groq returned no message:",
        data
      );

      return NextResponse.json(
        {
          error: "Groq returned an empty response.",
          model,
        },
        { status: 502 }
      );
    }

    // Return response to MathMind
    return NextResponse.json({
      message: answer,
      model,
    });
  } catch (error) {
    console.error("Chat API error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unknown server error.",
      },
      { status: 500 }
    );
  }
}
