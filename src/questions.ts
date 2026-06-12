// The big book of questions you can ask ANY friend — and how they answer.
// Answers are built from who they are (name, family, job) plus what's
// happening in the game (time of day, campaign level, friendship).

export interface Speaker {
  name: string;
  /** family surname, if they have one */
  surname?: string;
  /** what they do */
  role: 'villager' | 'trader' | 'castle-friend' | 'weasley' | 'hamlet' | 'elf' | 'mermaid' | 'dog';
}

export interface AnswerCtx {
  isNight: boolean;
  level: number;
  hearts: number;
  where: 'island' | 'castle' | 'shadow';
  levelName: string;
}

/** Stable per-person pick, so Wanda always has the same favorite color. */
function pick<T>(who: Speaker, salt: string, options: T[]): T {
  let h = salt.length;
  const s = who.name + salt;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return options[h % options.length];
}

const first = (who: Speaker) => who.name.split(' ')[0].replace('Mr. ', '').replace('Mrs. ', '');

export interface Question {
  q: string;
  answer: (who: Speaker, ctx: AnswerCtx) => string;
}

export const QUESTIONS: Question[] = [
  {
    q: 'How was your day?',
    answer: (who, ctx) => {
      if (who.role === 'elf') return ctx.isNight ? 'Pip had a WONDERFUL day! And now Pip is having a wonderful night!' : 'Pip is having the best day! Pip is with you!';
      if (ctx.isNight) return pick(who, 'day', ['Long! The stars came out and I am SO ready for bed.', 'Lovely, but my feet hurt. Night walks fix everything though.', 'Quiet day. Loud crickets tonight!']);
      return pick(who, 'day', ['Wonderful, thanks for asking! The sun is out and the carrots are growing.', 'Busy busy busy! There is always something to do in the village.', 'Pretty good — better now that you stopped by!']);
    },
  },
  {
    q: "What's your name?",
    answer: (who) => who.surname ? `${first(who)}! ${first(who)} ${who.surname}, of the ${who.surname} family.` : `${who.name}, at your service!`,
  },
  {
    q: 'Where do you live?',
    answer: (who) => {
      if (who.role === 'weasley') return 'The Burrow! The tall wobbly one. Best house in the village, no contest.';
      if (who.role === 'hamlet') return 'On this little island, far from the big one. Quietest spot in the whole sea.';
      if (who.role === 'castle-friend') return 'At the castle! The great hall is my favorite — the lanterns float, you know.';
      if (who.role === 'mermaid') return 'The sea, silly! All of it. Every wave is my living room.';
      if (who.role === 'elf') return 'Pip lives wherever YOU live. That is how it works with elves and friends.';
      return pick(who, 'home', ['Right here in the village — the house with the nicest carpet.', 'The manor by the street. Come in any time, the door opens now!', 'In the village. My bedroom has a label on it and everything.']);
    },
  },
  {
    q: "What's your favorite food?",
    answer: (who) => {
      if (who.name === 'Ron') return 'EVERYTHING. But mostly anything on a feast table. Or two feast tables.';
      if (who.role === 'mermaid') return 'Seaweed soup! You land-walkers are missing OUT.';
      return pick(who, 'food', ['Pumpkin pie, fresh from the feast table!', 'Crunchy carrots. The crunch is the best part.', 'Butterbrew! Mr. Fizzlepop makes it frothy.', 'Berries from the feast table. The red ones. Only the red ones.']);
    },
  },
  {
    q: "What's your favorite color?",
    answer: (who) => pick(who, 'color', ['Rose pink, like the carpets!', 'Sky blue, like a morning over the sea.', 'Mint green! Cozy-block mint, exactly that one.', 'Gold, like lantern light at night.', 'Purple! Dream Crystal purple.']),
  },
  {
    q: 'Do you like my building?',
    answer: (who, ctx) => ctx.hearts >= 3
      ? pick(who, 'build', ['I LOVE it. You are the finest builder this island has ever seen!', 'It is magnificent! Even Bram says so, and Bram built every roof here.', 'Best thing on the island! After my house. Joking, joking — yours!'])
      : pick(who, 'build2', ['Looking good! Add a lantern or two — everything is better with lanterns.', 'A solid start! Every great builder starts somewhere.', 'I like it! Try a carpet inside. Carpets change everything.']),
  },
  {
    q: 'What should I do next?',
    answer: (_who, ctx) => {
      if (ctx.level <= 1) return 'Craft your wand first — crystals and timber! Then the broom, then the key. The ruin is waiting.';
      if (ctx.level >= 11) return 'You saved the whole realm! Now build something enormous. Or duel me. Or both!';
      return `Everyone is talking about it: ${ctx.levelName}! Check your quest banner at the top — and be brave.`;
    },
  },
  {
    q: 'Are you scared of the monsters?',
    answer: (who, ctx) => {
      if (ctx.level >= 11) return 'Not anymore! Our hero took care of ALL of them. I heard even Lord You-Know-Who is gone.';
      if (who.role === 'weasley') return 'Scared? A Weasley? ...Yes. Very. Please keep whacking them.';
      return pick(who, 'scared', ['A little! I stay near the lamp posts at night.', 'The slimes are more bouncy than bitey. The trolls though... brrr.', 'I feel safe in the village. The enemies never come past the lamps!']);
    },
  },
  {
    q: "What's your job?",
    answer: (who) => {
      if (who.role === 'trader') return 'I run a shop! Bring me goodies and I will pour you something delicious.';
      if (who.role === 'elf') return 'Pip\'s job is helping! Pip is EXCELLENT at his job.';
      if (who.role === 'mermaid') return 'Professional wave-watcher. Also part-time gossip, full-time singer.';
      return pick(who, 'job', ['Gardener! The wild grass does not trim itself.', 'I watch the lamps. Someone must make sure they glow.', 'Baker! Every feast table you see? My work.', 'Storyteller. Sit down sometime, I have a hundred of them.']);
    },
  },
  {
    q: "Who's in your family?",
    answer: (who) => {
      if (who.role === 'weasley') return 'Mum, Dad, Bill, Percy, Fred, George, Ginny — and Ron at the castle. Yes, the Burrow gets loud.';
      if (who.surname) return `The ${who.surname}s! Come meet everyone — befriend the whole family and we leave gifts, you know.`;
      if (who.role === 'elf') return 'You! And the dogs. And everyone you are friends with. Pip has a big family now.';
      return 'The whole village feels like family, really.';
    },
  },
  {
    q: 'Can you tell me a joke?',
    answer: (who) => pick(who, 'joke', [
      'Why did the slime stay home? It was feeling a little GREEN.',
      'What do you call a wizard who lost his wand? Disappointed.',
      'Why do dementors love parties? They really know how to drain the mood!',
      'What is a troll\'s favorite meal? Anything it can club together.',
      'Why did the broom get promoted? It swept everyone off their feet!',
      'Knock knock. Who\'s there? A door. Finally! We just got those.',
    ]),
  },
  {
    q: "What's the weather like?",
    answer: (_who, ctx) => ctx.isNight
      ? 'Starry and still. Perfect sleeping weather — find a bed!'
      : 'Beautiful! Cloud-puffs drifting, lanterns resting. A perfect day for building.',
  },
  {
    q: 'Do you sleep at night?',
    answer: (who) => who.role === 'mermaid'
      ? 'I doze under the waves. The fish keep watch. Mostly.'
      : 'Of course! When the stars come out we all head inside. You have a bed too — use it, hero!',
  },
  {
    q: 'What makes you happy?',
    answer: (who, ctx) => ctx.hearts >= 5
      ? `Honestly? Visits from you, ${pick(who, 'pet', ['friend', 'hero', 'champion', 'neighbor'])}. Best part of my week.`
      : pick(who, 'happy', ['Warm bread, warm lanterns, warm days.', 'Watching the sunrise from my bedroom window.', 'Finding a treasure chest where there was not one before!']),
  },
  {
    q: 'Tell me a secret!',
    answer: (who) => pick(who, 'secret', [
      'The treasure chests on far islands hold the BEST loot. Take the broom.',
      'If you befriend a whole family, a gift chest appears. You did not hear it from me.',
      'The willow trees whomp. Do NOT stand under the dangly bits.',
      'Werewolves calm down faster if you keep moving while you whack.',
      'The mermaid knows everything that happens on this island. Everything.',
      'Doors open if you press them. We are all still amazed.',
    ]),
  },
  {
    q: 'How old are you?',
    answer: (who) => pick(who, 'age', ['Older than the village, younger than the ruin!', 'A wizard never tells. A wizard barely remembers.', 'Eleventy-something. The birthdays blur together.', 'Old enough to nap on purpose. It is wonderful.']),
  },
  {
    q: "What's your favorite block?",
    answer: (who) => {
      if (who.name === 'Pebble') return 'Rocks. All of them. But Marble is the fanciest rock, so: Marble.';
      return pick(who, 'block', ['Rainbow block! It is a party you can stack.', 'Star Lantern — it never stops glowing.', 'Bookshelf. A wall of stories!', 'Dream Crystal. It hums, you know. Listen closely.', 'Carpet! My toes have never been happier.']);
    },
  },
  {
    q: 'Do you want to be friends?',
    answer: (who, ctx) => ctx.hearts >= 3
      ? `We ARE friends, ${pick(who, 'pet2', ['silly', 'of course', 'forever'])}! Best ones!`
      : 'I would LOVE that. Keep visiting and bring your best jokes!',
  },
  {
    q: 'Have you seen anything strange lately?',
    answer: (_who, ctx) => {
      if (ctx.level >= 10) return 'The dark portal in the castle courtyard... I do not go near it. But YOU should, hero.';
      if (ctx.level >= 8) return 'Cold spots by the castle. They say dementors drift there now. Bring light!';
      if (ctx.level >= 2) return 'Strange creatures about! Good thing we have you and that wand.';
      return 'The beam of light by the old ruin glows brighter some nights. Wonder what it wants…';
    },
  },
];
