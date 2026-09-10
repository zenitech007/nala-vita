import { NextRequest, NextResponse } from "next/server";
import {
  getAuthenticatedMessagingUser,
  getAuthorizedMessageParticipant,
} from "../_access";

export async function GET(req: NextRequest) {
  try {
    const currentUser = await getAuthenticatedMessagingUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const otherUserId = req.nextUrl.searchParams.get("otherUserId")?.trim();
    if (!otherUserId) {
      return NextResponse.json(
        { error: "otherUserId is required" },
        { status: 400 }
      );
    }

    const otherUser = await getAuthorizedMessageParticipant(
      currentUser,
      otherUserId
    );

    if (!otherUser) {
      return NextResponse.json(
        { error: "Conversation is not available" },
        { status: 404 }
      );
    }

    const isDoctor = otherUser.role === "DOCTOR";
    return NextResponse.json({
      currentUserId: currentUser.id,
      participant: {
        id: otherUser.id,
        displayName: `${isDoctor ? "Dr. " : ""}${otherUser.firstName} ${otherUser.lastName}`,
        roleLabel: isDoctor
          ? otherUser.doctor?.specialization || "Doctor"
          : "Patient",
      },
    });
  } catch (error) {
    console.error("GET /api/messages/session error:", error);
    return NextResponse.json(
      { error: "Unable to load conversation" },
      { status: 500 }
    );
  }
}
