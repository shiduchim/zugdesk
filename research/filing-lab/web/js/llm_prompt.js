// The instructions and output format for the language-model engines (browser version).
// Same wording, examples and JSON schema as lab/engines/llm_engine.py, so the PC and browser
// versions of the models are tested the same way.

export const ROLES = ['shadchan', 'single', 'reference', 'family', 'other'];
export const EVENT_TYPES = ['call', 'message', 'meeting', 'date', 'suggestion', 'effort', 'profile_sent',
  'profile_received', 'reference_check', 'request', 'promise', 'note'];
export const ANSWERS = ['yes', 'no', 'thinking', 'more_info'];

const S = { type: ['string', 'null'], maxLength: 80 };
const NAME = { type: 'string', maxLength: 60 };
export const JSON_SCHEMA = {
  type: 'object',
  properties: {
    people: { type: 'array', maxItems: 6, items: { type: 'object', properties: {
      name: NAME, role: { enum: ROLES }, of: S }, required: ['name', 'role', 'of'] } },
    events: { type: 'array', maxItems: 4, items: { type: 'object', properties: {
      type: { enum: EVENT_TYPES }, actor: S, with: S, about: S, result: S,
      count: { type: ['integer', 'null'] }, when: S, negated: { type: 'boolean' } },
      required: ['type', 'actor', 'with', 'about', 'result', 'count', 'when', 'negated'] } },
    answers: { type: 'array', maxItems: 3, items: { type: 'object', properties: {
      of: NAME, about: S, value: { enum: ANSWERS }, source: S }, required: ['of', 'about', 'value', 'source'] } },
    tasks: { type: 'array', maxItems: 3, items: { type: 'object', properties: {
      who: S, what: { type: 'string', maxLength: 60 }, when: S }, required: ['who', 'what', 'when'] } },
    waiting: { type: 'array', maxItems: 3, items: { type: 'object', properties: {
      who: NAME, what: S, when: S }, required: ['who', 'what', 'when'] } },
    uncertain: { type: 'array', maxItems: 3, items: { type: 'string', maxLength: 80 } }
  },
  required: ['people', 'events', 'answers', 'tasks', 'waiting', 'uncertain']
};

export const SYSTEM_PROMPT = `You read ONE short note that a single person (the user, "me") typed into a private shidduch organizer, and you return JSON describing only what the note says.

Rules:
- Never add a name, date, answer, number or fact that is not in the note. If something is not stated, use null or leave the list empty.
- Copy names exactly as written ("Mrs. Cohen", "Rivky", "Leah's reference"). Do not invent surnames.
- "me" means the user. Do not list the user in people.
- Groups and amounts are not people ("three families", "nobody", "someone", "a girl").

people: every person named or described by relation ("David", "Mrs. Levin", "Rivka's mother", "Leah's reference").
  role: shadchan (matchmaker, or a friend who suggests, arranges or passes on news) | single (a possible match, or someone looking for a shidduch) | reference | family (a relative; put whose relative in "of") | other.
events: what happened. type: call | message | meeting | date | suggestion (someone suggested a single) | effort (a shadchan worked on finding someone) | profile_sent (I sent my profile) | profile_received | reference_check | request (someone asked for something) | promise (someone said they will do something) | note.
  actor = who did it ("me" for the user); with = the other side; about = the single it concerns; result = the outcome in the note's words; count = a number given in the note; when = the time words as written; negated = true if the note says it did not happen or not yet.
answers: only when the note reports someone's answer about a shidduch. of = whose answer ("me" for the user); about = the single (when of is "me"); value: yes | no | thinking (needs time, undecided) | more_info (wants more information); source = who told the user, if second-hand. If the answer is not known yet, or the note says it was not asked, add NO answer.
tasks: things the USER must do, only if the note asks for it: who = the person to contact; what = the action; when = the time words as written ("tomorrow", "in two days", "by Thursday"), or null.
waiting: when SOMEONE ELSE will contact the user or get back to them: who; what; when (time words as written).
uncertain: anything the note leaves open, in a few words.`;

export const FEW_SHOT = [
  ["Yehuda texted me that Mrs. Rosen's idea fell through. Remind me to call him Sunday.",
    { people: [{ name: 'Yehuda', role: 'other', of: null }, { name: 'Mrs. Rosen', role: 'shadchan', of: null }],
      events: [{ type: 'message', actor: 'Yehuda', with: 'me', about: null, result: "Mrs. Rosen's idea fell through", count: null, when: null, negated: false }],
      answers: [], tasks: [{ who: 'Yehuda', what: 'call', when: 'Sunday' }], waiting: [], uncertain: [] }],
  ["Mrs. Blum said Chavi's parents haven't decided yet, she'll update me after Yom Tov.",
    { people: [{ name: 'Mrs. Blum', role: 'shadchan', of: null }, { name: "Chavi's parents", role: 'family', of: 'Chavi' }, { name: 'Chavi', role: 'single', of: null }],
      events: [], answers: [], tasks: [],
      waiting: [{ who: 'Mrs. Blum', what: 'update me', when: 'after Yom Tov' }],
      uncertain: ["whether Chavi's parents agree"] }],
  ["Ari's sister told me Chavi said no. Sent my profile to Mrs. Blum.",
    { people: [{ name: "Ari's sister", role: 'family', of: 'Ari' }, { name: 'Chavi', role: 'single', of: null }, { name: 'Mrs. Blum', role: 'shadchan', of: null }],
      events: [{ type: 'profile_sent', actor: 'me', with: 'Mrs. Blum', about: null, result: null, count: null, when: null, negated: false }],
      answers: [{ of: 'Chavi', about: null, value: 'no', source: "Ari's sister" }],
      tasks: [], waiting: [], uncertain: [] }]
];

export function buildMessages(text) {
  const msgs = [{ role: 'system', content: SYSTEM_PROMPT }];
  for (const [note, out] of FEW_SHOT) {
    msgs.push({ role: 'user', content: note });
    msgs.push({ role: 'assistant', content: JSON.stringify(out) });
  }
  msgs.push({ role: 'user', content: text });
  return msgs;
}
