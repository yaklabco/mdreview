/**
 * Static emoji data for the comment reaction picker.
 * Native emoji rendering — no npm dependencies.
 */

export interface EmojiEntry {
  char: string;
  name: string;
  keywords?: string[];
}

export interface EmojiCategory {
  name: string;
  emojis: EmojiEntry[];
}

/**
 * 12 quick-access emojis shown in the top row of the picker.
 */
export const QUICK_EMOJIS: EmojiEntry[] = [
  { char: '\u{1F44D}', name: 'thumbs up', keywords: ['like', 'approve', 'yes'] },
  { char: '\u{1F44E}', name: 'thumbs down', keywords: ['dislike', 'disapprove', 'no'] },
  { char: '\u{1F604}', name: 'grinning face', keywords: ['happy', 'smile', 'laugh'] },
  { char: '\u{1F389}', name: 'party popper', keywords: ['celebrate', 'tada', 'hooray'] },
  { char: '\u{1F615}', name: 'confused face', keywords: ['confused', 'unsure'] },
  { char: '\u{2764}\u{FE0F}', name: 'red heart', keywords: ['love', 'heart'] },
  { char: '\u{1F680}', name: 'rocket', keywords: ['launch', 'ship', 'fast'] },
  { char: '\u{1F440}', name: 'eyes', keywords: ['look', 'see', 'watching'] },
  { char: '\u{2705}', name: 'check mark', keywords: ['done', 'complete', 'yes', 'approve'] },
  { char: '\u{274C}', name: 'cross mark', keywords: ['no', 'wrong', 'reject'] },
  { char: '\u{1F525}', name: 'fire', keywords: ['hot', 'lit', 'amazing'] },
  { char: '\u{2B50}', name: 'star', keywords: ['favorite', 'excellent', 'great'] },
];

/**
 * 8 emoji categories with ~200 emojis total.
 */
export const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    name: 'Smileys & People',
    emojis: [
      { char: '\u{1F600}', name: 'grinning face', keywords: ['happy', 'smile'] },
      { char: '\u{1F604}', name: 'grinning face with smiling eyes', keywords: ['happy', 'smile'] },
      { char: '\u{1F601}', name: 'beaming face', keywords: ['happy', 'grin'] },
      { char: '\u{1F606}', name: 'squinting face', keywords: ['laugh', 'happy'] },
      { char: '\u{1F605}', name: 'grinning face with sweat', keywords: ['relief'] },
      { char: '\u{1F602}', name: 'face with tears of joy', keywords: ['laugh', 'crying'] },
      { char: '\u{1F923}', name: 'rolling on the floor laughing', keywords: ['laugh', 'rofl'] },
      { char: '\u{1F60A}', name: 'smiling face with smiling eyes', keywords: ['blush', 'happy'] },
      { char: '\u{1F607}', name: 'smiling face with halo', keywords: ['angel', 'innocent'] },
      { char: '\u{1F609}', name: 'winking face', keywords: ['wink'] },
      { char: '\u{1F60C}', name: 'relieved face', keywords: ['calm', 'peaceful'] },
      { char: '\u{1F60D}', name: 'smiling face with heart-eyes', keywords: ['love', 'crush'] },
      { char: '\u{1F618}', name: 'face blowing a kiss', keywords: ['kiss', 'love'] },
      { char: '\u{1F914}', name: 'thinking face', keywords: ['think', 'hmm'] },
      { char: '\u{1F928}', name: 'face with raised eyebrow', keywords: ['skeptical', 'doubt'] },
      { char: '\u{1F610}', name: 'neutral face', keywords: ['meh', 'blank'] },
      { char: '\u{1F611}', name: 'expressionless face', keywords: ['blank'] },
      { char: '\u{1F636}', name: 'face without mouth', keywords: ['speechless', 'silence'] },
      { char: '\u{1F644}', name: 'face with rolling eyes', keywords: ['eyeroll'] },
      { char: '\u{1F615}', name: 'confused face', keywords: ['confused', 'unsure'] },
      { char: '\u{1F61F}', name: 'worried face', keywords: ['worried', 'nervous'] },
      { char: '\u{1F622}', name: 'crying face', keywords: ['sad', 'cry'] },
      { char: '\u{1F62D}', name: 'loudly crying face', keywords: ['sob', 'cry'] },
      { char: '\u{1F621}', name: 'pouting face', keywords: ['angry', 'rage'] },
      { char: '\u{1F631}', name: 'face screaming in fear', keywords: ['scream', 'horror'] },
      { char: '\u{1F4AA}', name: 'flexed biceps', keywords: ['strong', 'muscle'] },
      { char: '\u{1F44F}', name: 'clapping hands', keywords: ['clap', 'applause'] },
      { char: '\u{1F64F}', name: 'folded hands', keywords: ['pray', 'please', 'thanks'] },
      { char: '\u{1F91D}', name: 'handshake', keywords: ['agree', 'deal'] },
      { char: '\u{270C}\u{FE0F}', name: 'victory hand', keywords: ['peace'] },
    ],
  },
  {
    name: 'Nature',
    emojis: [
      { char: '\u{1F436}', name: 'dog face', keywords: ['puppy', 'pet'] },
      { char: '\u{1F431}', name: 'cat face', keywords: ['kitty', 'pet'] },
      { char: '\u{1F42D}', name: 'mouse face', keywords: ['mouse'] },
      { char: '\u{1F43B}', name: 'bear', keywords: ['bear'] },
      { char: '\u{1F98A}', name: 'fox', keywords: ['fox'] },
      { char: '\u{1F427}', name: 'penguin', keywords: ['penguin', 'linux'] },
      { char: '\u{1F41B}', name: 'bug', keywords: ['bug', 'insect'] },
      { char: '\u{1F40D}', name: 'snake', keywords: ['snake', 'python'] },
      { char: '\u{1F422}', name: 'turtle', keywords: ['slow', 'turtle'] },
      { char: '\u{1F419}', name: 'octopus', keywords: ['octopus'] },
      { char: '\u{1F332}', name: 'evergreen tree', keywords: ['tree', 'nature'] },
      { char: '\u{1F33B}', name: 'sunflower', keywords: ['flower'] },
      { char: '\u{1F340}', name: 'four leaf clover', keywords: ['luck', 'clover'] },
      { char: '\u{1F335}', name: 'cactus', keywords: ['desert', 'plant'] },
      { char: '\u{1F30A}', name: 'water wave', keywords: ['ocean', 'wave'] },
      { char: '\u{2600}\u{FE0F}', name: 'sun', keywords: ['sunny', 'weather'] },
      { char: '\u{1F319}', name: 'crescent moon', keywords: ['moon', 'night'] },
      { char: '\u{2B50}', name: 'star', keywords: ['favorite', 'excellent'] },
      { char: '\u{26A1}', name: 'lightning', keywords: ['electric', 'zap', 'thunder'] },
      { char: '\u{1F525}', name: 'fire', keywords: ['hot', 'lit', 'flame'] },
      { char: '\u{1F4A7}', name: 'droplet', keywords: ['water', 'drop'] },
      { char: '\u{2744}\u{FE0F}', name: 'snowflake', keywords: ['cold', 'winter'] },
      { char: '\u{1F308}', name: 'rainbow', keywords: ['rainbow'] },
    ],
  },
  {
    name: 'Food & Drink',
    emojis: [
      { char: '\u{1F34E}', name: 'red apple', keywords: ['apple', 'fruit'] },
      { char: '\u{1F34A}', name: 'tangerine', keywords: ['orange', 'fruit'] },
      { char: '\u{1F34B}', name: 'lemon', keywords: ['citrus'] },
      { char: '\u{1F34C}', name: 'banana', keywords: ['fruit'] },
      { char: '\u{1F353}', name: 'strawberry', keywords: ['fruit', 'berry'] },
      { char: '\u{1F349}', name: 'watermelon', keywords: ['fruit', 'summer'] },
      { char: '\u{1F355}', name: 'pizza', keywords: ['food'] },
      { char: '\u{1F354}', name: 'hamburger', keywords: ['burger', 'food'] },
      { char: '\u{1F37F}', name: 'popcorn', keywords: ['movie', 'snack'] },
      { char: '\u{2615}', name: 'hot beverage', keywords: ['coffee', 'tea'] },
      { char: '\u{1F37A}', name: 'beer mug', keywords: ['beer', 'drink'] },
      { char: '\u{1F377}', name: 'wine glass', keywords: ['wine', 'drink'] },
      { char: '\u{1F375}', name: 'teacup', keywords: ['tea', 'drink'] },
      { char: '\u{1F382}', name: 'birthday cake', keywords: ['cake', 'celebration'] },
      { char: '\u{1F369}', name: 'donut', keywords: ['doughnut', 'sweet'] },
      { char: '\u{1F36B}', name: 'chocolate bar', keywords: ['chocolate', 'sweet'] },
      { char: '\u{1F950}', name: 'croissant', keywords: ['bread', 'pastry'] },
      { char: '\u{1F96A}', name: 'sandwich', keywords: ['food'] },
      { char: '\u{1F32E}', name: 'taco', keywords: ['mexican', 'food'] },
      { char: '\u{1F363}', name: 'sushi', keywords: ['japanese', 'food'] },
    ],
  },
  {
    name: 'Activities',
    emojis: [
      { char: '\u{26BD}', name: 'soccer ball', keywords: ['football', 'sport'] },
      { char: '\u{1F3C0}', name: 'basketball', keywords: ['sport'] },
      { char: '\u{1F3C8}', name: 'american football', keywords: ['sport'] },
      { char: '\u{26BE}', name: 'baseball', keywords: ['sport'] },
      { char: '\u{1F3BE}', name: 'tennis', keywords: ['sport'] },
      { char: '\u{1F3AF}', name: 'bullseye', keywords: ['target', 'dart'] },
      { char: '\u{1F3AE}', name: 'video game', keywords: ['game', 'controller'] },
      { char: '\u{265F}\u{FE0F}', name: 'chess pawn', keywords: ['chess', 'game', 'strategy'] },
      { char: '\u{1F3B2}', name: 'game die', keywords: ['dice', 'game', 'random'] },
      { char: '\u{1F3B5}', name: 'musical note', keywords: ['music', 'note'] },
      { char: '\u{1F3B6}', name: 'musical notes', keywords: ['music'] },
      { char: '\u{1F3A4}', name: 'microphone', keywords: ['sing', 'karaoke'] },
      { char: '\u{1F3AC}', name: 'clapper board', keywords: ['movie', 'film'] },
      { char: '\u{1F3A8}', name: 'artist palette', keywords: ['art', 'paint'] },
      { char: '\u{1F3AD}', name: 'performing arts', keywords: ['theater', 'drama'] },
      { char: '\u{1F3C6}', name: 'trophy', keywords: ['winner', 'award', 'prize'] },
      { char: '\u{1F3C5}', name: 'sports medal', keywords: ['medal', 'award'] },
      { char: '\u{1F947}', name: 'first place medal', keywords: ['gold', 'winner'] },
      { char: '\u{1F948}', name: 'second place medal', keywords: ['silver'] },
      { char: '\u{1F949}', name: 'third place medal', keywords: ['bronze'] },
    ],
  },
  {
    name: 'Travel & Places',
    emojis: [
      { char: '\u{1F697}', name: 'automobile', keywords: ['car'] },
      { char: '\u{1F680}', name: 'rocket', keywords: ['launch', 'ship', 'space'] },
      { char: '\u{2708}\u{FE0F}', name: 'airplane', keywords: ['travel', 'flight'] },
      { char: '\u{1F6A2}', name: 'ship', keywords: ['boat', 'cruise'] },
      { char: '\u{1F682}', name: 'locomotive', keywords: ['train'] },
      { char: '\u{1F6B2}', name: 'bicycle', keywords: ['bike', 'cycling'] },
      { char: '\u{1F3E0}', name: 'house', keywords: ['home'] },
      { char: '\u{1F3D7}\u{FE0F}', name: 'building construction', keywords: ['construction'] },
      { char: '\u{1F3D4}\u{FE0F}', name: 'snow-capped mountain', keywords: ['mountain'] },
      { char: '\u{1F3D6}\u{FE0F}', name: 'beach', keywords: ['beach', 'vacation'] },
      { char: '\u{1F30D}', name: 'globe europe-africa', keywords: ['world', 'earth'] },
      { char: '\u{1F30E}', name: 'globe americas', keywords: ['world', 'earth'] },
      { char: '\u{1F5FA}\u{FE0F}', name: 'world map', keywords: ['map', 'travel'] },
      { char: '\u{26F0}\u{FE0F}', name: 'mountain', keywords: ['mountain'] },
      { char: '\u{1F30B}', name: 'volcano', keywords: ['eruption'] },
    ],
  },
  {
    name: 'Objects',
    emojis: [
      { char: '\u{1F4BB}', name: 'laptop', keywords: ['computer', 'code'] },
      { char: '\u{1F4F1}', name: 'mobile phone', keywords: ['phone', 'cell'] },
      { char: '\u{2328}\u{FE0F}', name: 'keyboard', keywords: ['type', 'computer'] },
      { char: '\u{1F4A1}', name: 'light bulb', keywords: ['idea', 'bright'] },
      { char: '\u{1F50D}', name: 'magnifying glass', keywords: ['search', 'find'] },
      { char: '\u{1F512}', name: 'locked', keywords: ['lock', 'security'] },
      { char: '\u{1F513}', name: 'unlocked', keywords: ['unlock', 'open'] },
      { char: '\u{1F527}', name: 'wrench', keywords: ['tool', 'fix'] },
      { char: '\u{1F528}', name: 'hammer', keywords: ['tool', 'build'] },
      { char: '\u{2699}\u{FE0F}', name: 'gear', keywords: ['settings', 'config'] },
      { char: '\u{1F4E6}', name: 'package', keywords: ['box', 'delivery'] },
      { char: '\u{1F4CB}', name: 'clipboard', keywords: ['paste', 'list'] },
      { char: '\u{1F4DD}', name: 'memo', keywords: ['note', 'write'] },
      { char: '\u{1F4DA}', name: 'books', keywords: ['library', 'read'] },
      { char: '\u{1F4D6}', name: 'open book', keywords: ['read', 'study'] },
      { char: '\u{2709}\u{FE0F}', name: 'envelope', keywords: ['email', 'mail'] },
      { char: '\u{1F4CE}', name: 'paperclip', keywords: ['attach'] },
      { char: '\u{270F}\u{FE0F}', name: 'pencil', keywords: ['write', 'edit'] },
      { char: '\u{1F4CC}', name: 'pushpin', keywords: ['pin', 'location'] },
      { char: '\u{1F5D1}\u{FE0F}', name: 'wastebasket', keywords: ['trash', 'delete'] },
      { char: '\u{1F3F7}\u{FE0F}', name: 'label', keywords: ['tag'] },
      { char: '\u{1F4CA}', name: 'bar chart', keywords: ['chart', 'graph', 'stats'] },
      { char: '\u{1F4C8}', name: 'chart increasing', keywords: ['growth', 'up'] },
      { char: '\u{1F4C9}', name: 'chart decreasing', keywords: ['decline', 'down'] },
      { char: '\u{23F0}', name: 'alarm clock', keywords: ['time', 'clock'] },
    ],
  },
  {
    name: 'Symbols',
    emojis: [
      { char: '\u{2764}\u{FE0F}', name: 'red heart', keywords: ['love'] },
      { char: '\u{1F49B}', name: 'yellow heart', keywords: ['love'] },
      { char: '\u{1F49A}', name: 'green heart', keywords: ['love'] },
      { char: '\u{1F499}', name: 'blue heart', keywords: ['love'] },
      { char: '\u{1F49C}', name: 'purple heart', keywords: ['love'] },
      { char: '\u{2705}', name: 'check mark', keywords: ['done', 'complete', 'yes'] },
      { char: '\u{274C}', name: 'cross mark', keywords: ['no', 'wrong', 'reject'] },
      { char: '\u{2757}', name: 'exclamation mark', keywords: ['important', 'alert'] },
      { char: '\u{2753}', name: 'question mark', keywords: ['question', 'help'] },
      { char: '\u{1F4AF}', name: 'hundred points', keywords: ['perfect', '100'] },
      { char: '\u{267B}\u{FE0F}', name: 'recycling symbol', keywords: ['recycle', 'green'] },
      { char: '\u{26A0}\u{FE0F}', name: 'warning', keywords: ['caution', 'alert'] },
      { char: '\u{1F6AB}', name: 'prohibited', keywords: ['banned', 'forbidden'] },
      { char: '\u{2139}\u{FE0F}', name: 'information', keywords: ['info', 'help'] },
      { char: '\u{1F503}', name: 'clockwise arrows', keywords: ['refresh', 'reload'] },
      { char: '\u{1F504}', name: 'counterclockwise arrows', keywords: ['undo', 'back'] },
      { char: '\u{2B06}\u{FE0F}', name: 'up arrow', keywords: ['up'] },
      { char: '\u{2B07}\u{FE0F}', name: 'down arrow', keywords: ['down'] },
      { char: '\u{27A1}\u{FE0F}', name: 'right arrow', keywords: ['right', 'next'] },
      { char: '\u{2B05}\u{FE0F}', name: 'left arrow', keywords: ['left', 'back'] },
    ],
  },
  {
    name: 'Flags',
    emojis: [
      { char: '\u{1F3C1}', name: 'chequered flag', keywords: ['finish', 'race'] },
      { char: '\u{1F6A9}', name: 'triangular flag', keywords: ['flag', 'alert'] },
      { char: '\u{1F3F4}', name: 'black flag', keywords: ['flag'] },
      { char: '\u{1F3F3}\u{FE0F}', name: 'white flag', keywords: ['surrender', 'peace'] },
      { char: '\u{1F3F3}\u{FE0F}\u{200D}\u{1F308}', name: 'rainbow flag', keywords: ['pride', 'lgbtq'] },
    ],
  },
];

/**
 * Search emojis across all categories by name or keyword.
 * Returns matching EmojiEntry items, deduplicated by char.
 */
export function searchEmojis(query: string): EmojiEntry[] {
  if (!query) return [];

  const lowerQuery = query.toLowerCase();
  const seen = new Set<string>();
  const results: EmojiEntry[] = [];

  // Search quick emojis first
  for (const emoji of QUICK_EMOJIS) {
    if (matchesQuery(emoji, lowerQuery) && !seen.has(emoji.char)) {
      seen.add(emoji.char);
      results.push(emoji);
    }
  }

  // Then search all categories
  for (const cat of EMOJI_CATEGORIES) {
    for (const emoji of cat.emojis) {
      if (matchesQuery(emoji, lowerQuery) && !seen.has(emoji.char)) {
        seen.add(emoji.char);
        results.push(emoji);
      }
    }
  }

  return results;
}

function matchesQuery(emoji: EmojiEntry, lowerQuery: string): boolean {
  if (emoji.name.toLowerCase().includes(lowerQuery)) return true;
  if (emoji.keywords) {
    return emoji.keywords.some((kw) => kw.toLowerCase().includes(lowerQuery));
  }
  return false;
}
