// The big book of questions you can ask ANY friend — and how they answer.
// Answers are built from who they are (name, family, job) plus what's
// happening in the game (time of day, campaign level, friendship).
// Each person has their OWN stable answers, so two friends rarely match.

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

/**
 * Strong avalanche string hash (FNV-1a + xorshift finalizer). Unlike a plain
 * polynomial hash, this mixes bits well, so `% optionCount` is evenly spread
 * for ANY list length — no "everyone picks option 0" clustering.
 */
function hashStr(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 3266489917) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

/** Stable per-person pick: the same person always answers the same, but
 *  different people land on different answers across the whole list. */
function pick<T>(who: Speaker, salt: string, options: T[]): T {
  return options[hashStr(who.name + '|' + salt) % options.length];
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
      if (ctx.isNight) return pick(who, 'night', ['Long! The stars came out and I am SO ready for bed.', 'Lovely, but my feet hurt. Night walks fix everything.', 'Quiet day, loud crickets tonight!', 'Sleepy! Is it bedtime yet? It is bedtime.', 'I counted nine shooting stars. NINE!']);
      return pick(who, 'day', ['Wonderful, thanks for asking! The carrots are growing.', 'Busy busy busy! Always something to do in the village.', 'Pretty good — better now that you stopped by!', 'I dropped a pumpkin on my foot. Otherwise, great!', 'I danced with a butterfly this morning. True story.', 'Sunny and slow. My favorite kind.']);
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
      return pick(who, 'home', ['Right here in the village — the house with the nicest carpet.', 'The manor by the street. Come in any time, the door opens now!', 'In the village. My bedroom has a label and everything.', 'Top floor, third window. I wave at the clouds.']);
    },
  },
  {
    q: "What's your favorite food?",
    answer: (who) => {
      if (who.name === 'Ron') return 'EVERYTHING. But mostly anything on a feast table. Or two feast tables.';
      if (who.role === 'mermaid') return 'Seaweed soup! You land-walkers are missing OUT.';
      if (who.role === 'dog') return 'Woof! (That means snacks. Any snacks. All snacks.)';
      return pick(who, 'food', [
        'Crunchy carrots! The crunch is the whole point.',
        'Hot ramen with a swirl of egg. Slurp!',
        'Pumpkin pie, fresh and wobbly.',
        'Watermelon. I spit the seeds REALLY far.',
        'Pizza! With extra everything.',
        'Mushroom soup on a cold night. Mmm.',
        'Tacos. Crunchy ones. Always crunchy.',
        'Ice cream! Even in winter. ESPECIALLY in winter.',
        'Buttered toast. Simple. Perfect.',
        'Frothy Butterbrew and a warm bun.',
        'Berries — the red ones. Only the red ones.',
        'Noodles. So many noodles. A mountain of noodles.',
      ]);
    },
  },
  {
    q: "What's your favorite color?",
    answer: (who) => pick(who, 'color', [
      'Rose pink, like the carpets!',
      'Sky blue, like a morning over the sea.',
      'Mint green! That exact cozy block.',
      'Gold, like lantern light at night.',
      'Purple — Dream Crystal purple.',
      'Sunset orange, like a baked pumpkin.',
      'Rainbow! That counts. It TOTALLY counts.',
      'Snow white, clean as a fresh morning.',
      'Deep night-blue with little stars in it.',
      'Grass green. The whole island wears it.',
    ]),
  },
  {
    q: 'Do you like my building?',
    answer: (who, ctx) => ctx.hearts >= 3
      ? pick(who, 'build', ['I LOVE it. Finest builder this island has ever seen!', 'Magnificent! Even Bram says so, and Bram built every roof.', 'Best thing on the island! After my house. Joking — yours!', 'I want to MOVE IN. Is there a spare room?'])
      : pick(who, 'build2', ['Looking good! Add a lantern — everything is better with lanterns.', 'A solid start! Every great builder starts somewhere.', 'I like it! Try a carpet inside. Carpets change everything.', 'Promising! Needs a pumpkin by the door, if you ask me.']),
  },
  {
    q: 'What should I do next?',
    answer: (_who, ctx) => {
      if (ctx.level <= 1) return 'Craft your wand first — crystals and timber! Then the broom, then the key. The ruin is waiting.';
      if (ctx.level >= 11) return 'You saved the whole realm! Now build something enormous. Or duel me. Or both!';
      return `Everyone is talking about it: ${ctx.levelName}! Check your quest banner up top — and be brave.`;
    },
  },
  {
    q: 'Are you scared of the monsters?',
    answer: (who, ctx) => {
      if (ctx.level >= 11) return 'Not anymore! Our hero took care of ALL of them. Even You-Know-Who is gone.';
      if (who.role === 'weasley') return 'Scared? A Weasley? ...Yes. Very. Please keep whacking them.';
      return pick(who, 'scared', ['A little! I stay near the lamp posts at night.', 'The slimes are more bouncy than bitey. The trolls though... brrr.', 'I feel safe in the village. Enemies never come past the lamps!', 'Only the dark ones. The light keeps them away — and so do you.']);
    },
  },
  {
    q: "What's your job?",
    answer: (who) => {
      if (who.role === 'trader') return 'I run a shop! Bring me goodies and I will pour you something delicious.';
      if (who.role === 'elf') return "Pip's job is helping! Pip is EXCELLENT at his job.";
      if (who.role === 'mermaid') return 'Professional wave-watcher. Also part-time gossip, full-time singer.';
      if (who.role === 'dog') return 'Woof! (Chief tail-wagger and village good boy.)';
      return pick(who, 'job', ['Gardener! The wild grass does not trim itself.', 'Lamp-keeper. Someone must make sure they glow.', 'Baker! Every feast table you see? My work.', 'Storyteller. Sit down sometime, I have a hundred.', 'Cloud-counter. It is harder than it sounds.', 'Crystal polisher. Sparkly work, sparkly pay.']);
    },
  },
  {
    q: "Who's in your family?",
    answer: (who) => {
      if (who.role === 'weasley') return 'Mum, Dad, Bill, Percy, Fred, George, Ginny — and Ron at the castle. Yes, the Burrow gets loud.';
      if (who.surname) return `The ${who.surname}s! Befriend the whole family and we leave gifts, you know.`;
      if (who.role === 'elf') return 'You! And the dogs. And everyone you are friends with. Pip has a big family now.';
      return 'The whole village feels like family, really.';
    },
  },
  {
    q: 'Can you tell me a joke?',
    answer: (who) => pick(who, 'joke', [
      'Why did the slime stay home? It felt a little GREEN.',
      'What do you call a wizard who lost his wand? Disappointed.',
      'Why do dementors love parties? They drain the mood!',
      "What is a troll's favorite meal? Anything it can club together.",
      'Why did the broom get promoted? It swept everyone off their feet!',
      'Knock knock. Who is there? A door. FINALLY, we just got those.',
      'What do you call a sleepy pumpkin? A pump-KIN-napping.',
      'Why did the carrot blush? It saw the salad dressing!',
      'How does the mermaid pay for things? With sand dollars.',
      'What is a ghost\'s favorite block? Boo-kshelf.',
    ]),
  },
  {
    q: "What's the weather like?",
    answer: (_who, ctx) => ctx.isNight
      ? 'Starry and still. Perfect sleeping weather — find a bed!'
      : 'Beautiful! Cloud-puffs drifting, lanterns resting. A perfect day to build.',
  },
  {
    q: 'Do you sleep at night?',
    answer: (who) => who.role === 'mermaid'
      ? 'I doze under the waves. The fish keep watch. Mostly.'
      : pick(who, 'sleep', ['Of course! When the stars come out, inside we go.', 'Like a log. A very cozy, snoring log.', 'Eventually. I stay up counting shooting stars.', 'In my labeled bedroom, under a warm blanket. Bliss.']),
  },
  {
    q: 'What makes you happy?',
    answer: (who, ctx) => ctx.hearts >= 5
      ? `Honestly? Visits from you, ${pick(who, 'pet', ['friend', 'hero', 'champion', 'neighbor', 'star'])}. Best part of my week.`
      : pick(who, 'happy', ['Warm bread, warm lanterns, warm days.', 'Watching the sunrise from my window.', 'Finding a treasure chest where there was not one before!', 'A tidy carpet and a frothy Butterbrew.', 'The sound of the sea at night.', 'Pumpkins. Round ones. Just look at them.']),
  },
  {
    q: 'Tell me a secret!',
    answer: (who) => pick(who, 'secret', [
      'The treasure chests on far islands hold the BEST loot. Take the broom.',
      'Befriend a whole family and a gift chest appears. You did not hear it from me.',
      'The willow trees whomp. Do NOT stand under the dangly bits.',
      'Werewolves calm faster if you keep moving while you whack.',
      'The mermaid knows everything that happens here. Everything.',
      'Doors open if you press them. We are all still amazed.',
      'Sleep in a bed at night and you wake with all your hearts. Magic!',
      'There is a beam of light by the ruin. It points somewhere special.',
    ]),
  },
  {
    q: 'How old are you?',
    answer: (who) => pick(who, 'age', ['Older than the village, younger than the ruin!', 'A wizard never tells. A wizard barely remembers.', 'Eleventy-something. The birthdays blur.', 'Old enough to nap on purpose. It is wonderful.', 'I stopped counting at "lots."']),
  },
  {
    q: "What's your favorite block?",
    answer: (who) => {
      if (who.name === 'Pebble') return 'Rocks. All of them. But Marble is the fanciest rock, so: Marble.';
      return pick(who, 'block', ['Rainbow block! A party you can stack.', 'Star Lantern — it never stops glowing.', 'Bookshelf. A whole wall of stories!', 'Dream Crystal. It hums, you know. Listen.', 'Carpet! My toes have never been happier.', 'Blossom. Smells like spring all year.', 'Snow. I sculpt little snow-pets from it.', 'Glass, so I can wave at the clouds.']);
    },
  },
  {
    q: 'Do you want to be friends?',
    answer: (who, ctx) => ctx.hearts >= 3
      ? `We ARE friends, ${pick(who, 'pet2', ['silly', 'of course', 'forever', 'best one'])}!`
      : 'I would LOVE that. Keep visiting and bring your best jokes!',
  },
  {
    q: 'What do you dream about?',
    answer: (who) => pick(who, 'dream', [
      'Flying! On a broom, over all the little islands.',
      'A pie so big the whole village could share it.',
      'Meeting a real dragon. A friendly one. Please be friendly.',
      'A house with a hundred rooms, each a different color.',
      'Singing with the mermaid under a full moon.',
      'Treasure. Mountains of it. With my name on the chest.',
    ]),
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
