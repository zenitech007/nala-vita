// src/lib/amelia/functional.ts
//
// Functional-inference cues.
//
// Patients often describe neurological or motor changes through the *task that
// failed* rather than the body part that failed — "my lipstick wears unevenly",
// "my key sticks in the lock", "the fingerprint sensor stopped knowing my thumb".
// Framed that way, the question looks cosmetic or mechanical, and an assistant
// that waits for "I have a tremor" answers it as a beauty or hardware problem.
//
// These rules do NOT decide anything and are deliberately separate from
// safety.ts: a red flag short-circuits the LLM with "seek emergency care", which
// would be badly wrong for a sticky lock. A functional cue only injects probing
// questions into the prompt so the model asks about the body instead of the object.

export type FunctionalCueKind =
  | "ASYMMETRY"
  | "CONTROL_DISCREPANCY"
  | "FATIGUE_PATTERN"
  | "FINE_MOTOR"
  | "DEVICE_BIOMETRIC"
  | "NON_MEDICAL_FRAMING";

export interface FunctionalCue {
  kind: FunctionalCueKind;
  /** Why this phrasing is worth a second look. */
  reason: string;
  /** The question Amelia should actually ask the patient. */
  probe: string;
}

interface Rule {
  kind: FunctionalCueKind;
  test: RegExp;
  reason: string;
  probe: string;
}

const RULES: Rule[] = [
  {
    kind: "ASYMMETRY",
    // One-sidedness, however it's phrased — "one side", "left but not right",
    // "unevenly", "only my right hand".
    test: /\b(?:on(?:ly)? one side|one side (?:only|more|but not)|uneven(?:ly)?|asymmetric(?:al)?|lopsided|off ?to one side|(?:left|right) side (?:but not|more than|only)|only (?:my )?(?:left|right)|(?:my )?(?:left|right) (?:one|hand|thumb|finger|foot|leg|arm|eye|cheek|lip)\b[^.?!]{0,40}\b(?:but not|not the other|and not)|one (?:hand|thumb|eye|cheek|foot|leg|arm)\b[^.?!]{0,30}\bnot the other)\b/i,
    reason: "One-sided / uneven pattern — asymmetry can reflect unequal muscle control, strength or sensation rather than a cosmetic or mechanical cause",
    probe:
      "Ask whether the asymmetry is noticeable in other ways — visible difference at rest, drooling or food collecting on one side, weaker grip or altered sensation on that side, or a difference others have commented on.",
  },
  {
    kind: "CONTROL_DISCREPANCY",
    // The single most diagnostic pattern: same object, same conditions, a
    // different person succeeds. That isolates the variable to the patient.
    test: /\b(?:but|however|though|yet|while)\b[^.?!]{0,60}\b(?:my )?(?:husband|wife|partner|spouse|boyfriend|girlfriend|son|daughter|mother|father|mom|dad|roommate|flatmate|colleague|coworker|friend|kids?|children|anyone else|everyone else|someone else|other people)\b[^.?!]{0,60}\b(?:can|does|has no|doesn'?t have|manages|opens|uses|gets|works|is)\b|\b(?:my )?(?:husband|wife|partner|spouse|boyfriend|girlfriend|son|daughter|mother|father|mom|dad|roommate|flatmate|colleague|coworker|friend|anyone else|everyone else|someone else|other people)\b[^.?!]{0,50}\b(?:can|opens|does|uses|manages)\b[^.?!]{0,40}\b(?:fine|no problem|without (?:any )?(?:trouble|problem|issue)|easily|just fine|perfectly|no trouble|first time|every time)\b/i,
    reason: "Control discrepancy — the same object behaves differently for someone else, which points at the person rather than the object",
    probe:
      "Note explicitly that if another person operates the same object without difficulty, the object is unlikely to be the cause. Ask about the patient's hands directly: grip strength, steadiness, tremor, numbness or tingling, and whether other fine tasks have changed.",
  },
  {
    kind: "FATIGUE_PATTERN",
    // Time-of-day or exertion-dependent performance. Guarded so a plain
    // "take it in the morning" dosing question does not trip it.
    // Two shapes: an explicit fatigue/time phrase, or a failure verb pinned to a
    // time of day ("stopped working in the morning"). The second shape requires the
    // failure verb so that a plain dosing question — "can I take this in the
    // morning?" — does not trip it.
    test: /\b(?:after work|end of the day|by (?:the )?(?:evening|night|end of the day)|later in the day|when (?:i'?m |i am )?tired|when (?:i'?m |i am )?fatigued|as the day (?:goes on|wears on|progresses)|worse (?:in the |at )?(?:evening|night|afternoon)s?|worse (?:when|after) (?:i'?m tired|resting|exertion|activity)|fine (?:in the |at )?(?:morning|noon|midday)[^.?!]{0,40}\b(?:but|then|and)\b|(?:in|during) the morning[^.?!]{0,40}\b(?:but|then)\b[^.?!]{0,40}\b(?:not|worse|harder|fails?|stops?)|only (?:in the |at )?(?:morning|evening|night)s?\b|first thing in the morning|(?:stopped|stops|won'?t|doesn'?t|can'?t|cannot|fail(?:s|ing|ed)?|worse|harder|swollen|puffy|stiff|numb|weak(?:er)?|struggl(?:e|es|ing))\b[^.?!]{0,40}\b(?:in the (?:morning|evening|afternoon)s?|at night|overnight|after (?:i )?(?:wake|waking|sleep|sleeping))\b)\b/i,
    reason: "Time-of-day or fatigue-dependent change — functional degradation that tracks fatigue or a daily cycle is a recognised pattern in neuromuscular and fluid-balance conditions",
    probe:
      "Ask how the difficulty tracks through the day and with rest — whether it is reliably better after sleep and worse with sustained use, and whether anything else (vision, chewing, speech, swallowing, stair climbing) fades the same way.",
  },
  {
    kind: "FINE_MOTOR",
    test: /\b(?:drop(?:ping|s|ped)? (?:things|stuff|my|it|cups?|glasses|plates?)|fumbl(?:e|ing|es)|butter ?fingers|can'?t (?:seem to )?(?:grip|hold|grasp|button|zip|unscrew|open)|can'?t (?:seem to )?(?:get|take|twist|turn|pull|work)\b[^.?!]{0,30}\b(?:off|open|undone|loose|unscrewed)|hard(?:er)? to (?:grip|hold|button|zip|unscrew|open|write|type)|(?:buttons?|zips?|zippers?|shoe ?laces|laces|jar lids?|lids?|bottle caps?|keys?)\b[^.?!]{0,40}\b(?:hard|harder|difficult|tricky|struggle|can'?t|impossible|fiddly)|struggl(?:e|ing) (?:to|with) (?:grip|hold|button|open|unscrew|write|type)|(?:my )?(?:hand ?writing|writing) (?:has |is |got )?(?:gotten |become )?(?:smaller|messier|worse|shaky|illegible)|shaky (?:hands?|grip)|hands? (?:are |feel |get )?(?:clumsy|unsteady|shaky|weak))\b/i,
    reason: "Fine-motor difficulty described through the failing task rather than the hand",
    probe:
      "Ask when this started and whether it has progressed, whether it affects one or both hands, and whether there is tremor at rest, stiffness, cramping, numbness, tingling or weakness alongside it.",
  },
  {
    kind: "DEVICE_BIOMETRIC",
    // A biometric sensor is a crude measuring instrument pointed at the body.
    // Persistent failure can mean the body changed, not the sensor.
    test: /\b(?:finger ?print (?:sensor|scanner|reader|id|unlock|login)?|touch ?id|face ?id|facial recognition|face unlock|pulse ?ox(?:imeter)?|oximeter|smart ?watch|fitness tracker|blood pressure (?:cuff|monitor)|bp (?:cuff|monitor))\b[^.?!]{0,80}\b(?:stopped|won'?t|doesn'?t|can'?t|fail(?:s|ing|ed)?|not (?:reading|recognis|recogniz|working|detect)|unreliable|keeps? (?:failing|rejecting)|no longer|error|inaccurate|weird reading)/i,
    reason: "Biometric or wearable device failure — these sensors measure the body, so a persistent change in readings can reflect the body rather than the hardware",
    probe:
      "Treat the device as an imperfect measurement of the body. Ask whether the relevant body part looks or feels different — swelling, puffiness, colour or temperature change, dryness, numbness, or a difference between the two sides — and whether it varies with time of day.",
  },
  {
    kind: "NON_MEDICAL_FRAMING",
    // The patient apologising for the question is itself a signal — they
    // noticed something odd but lack the vocabulary to call it a symptom.
    test: /\b(?:(?:probably|maybe|might be|this is) (?:not|nothing) (?:a )?(?:health|medical)(?:[- ]related)?|not (?:really )?(?:a )?(?:health|medical) (?:question|thing|issue|related)|nothing to do with (?:health|medicine|my health)|(?:random|weird|silly|strange|odd|dumb|stupid) (?:question|one)|off[- ]topic|unrelated(?:,| but)|sorry if this is(?:n'?t)?|i know this (?:sounds|is) (?:weird|strange|silly|random)|this (?:might|may) (?:sound|seem) (?:weird|strange|silly|random))\b/i,
    reason: "Patient pre-emptively framed the question as non-medical — a common presentation when someone has noticed a change but lacks the vocabulary to name it as a symptom",
    probe:
      "Do not accept the non-medical framing at face value. Answer the practical question if it has an answer, then gently explore whether the body could be the variable.",
  },
];

export function detectFunctionalCues(text: string): FunctionalCue[] {
  return RULES.filter((r) => r.test.test(text)).map(({ kind, reason, probe }) => ({
    kind,
    reason,
    probe,
  }));
}

export function renderFunctionalCues(cues: FunctionalCue[]): string {
  if (cues.length === 0) return "";
  const lines = cues.map((c) => `- ${c.kind} — ${c.reason}\n  → ${c.probe}`).join("\n");
  return `

FUNCTIONAL INFERENCE SIGNALS DETECTED IN THIS MESSAGE:
${lines}

The patient has framed this as a cosmetic, practical or mechanical problem, but the phrasing carries a possible functional-health signal. For this turn:
- Do NOT dismiss the topic as "not health-related" and do NOT stop at the cosmetic or mechanical explanation. Give the practical answer briefly if one exists, then explore the body.
- Weave the probe questions above into your reply naturally — ask, don't interrogate, and keep it to the two or three most relevant.
- Reason from the discrepancy: if the same task fails for this patient but not for someone else, or fails at one time of day but not another, or on one side but not the other, say plainly that this pattern points to the person rather than the object.
- Stay calm and non-alarmist. Do not name a specific frightening diagnosis. Frame it as "worth having a clinician look at this properly", and offer to help book an appointment.`;
}
