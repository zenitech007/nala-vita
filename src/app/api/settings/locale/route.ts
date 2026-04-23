import { NextRequest, NextResponse } from "next/server";

const SUPPORTED_LOCALES = ["en", "fr", "yo", "ha", "ig"];

export async function POST(req: NextRequest) {
  try {
    const { locale } = await req.json();

    if (!locale || !SUPPORTED_LOCALES.includes(locale)) {
      return NextResponse.json(
        { error: "Unsupported locale" },
        { status: 400 }
      );
    }

    const response = NextResponse.json({ locale });

    response.cookies.set("NEXT_LOCALE", locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365, // 1 year
      sameSite: "lax",
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}
