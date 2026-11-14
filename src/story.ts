/** Teja & Pranati's story — the words used across the museum. Edit here to change them everywhere. */

export const COUPLE = { boy: 'Teja', girl: 'Pranati' } as const;
export const STORY_BEGAN = 'March 17, 2023';

export type Speaker = 'teja' | 'pranati' | 'both';

/** The welcome conversation at the entrance. */
export const WELCOME_DIALOGUE: { who: Speaker; text: string }[] = [
  { who: 'teja', text: 'Hey everyone! Welcome!' },
  { who: 'pranati', text: "We're so happy you are here!" },
  { who: 'teja', text: 'Thank you for coming to explore our little world.' },
  { who: 'pranati', text: 'This museum holds our memories, our happiness, and our beautiful journey.' },
  { who: 'teja', text: 'So, what are you waiting for?' },
  { who: 'both', text: "Come on, everyone! Let's explore our journey together!" },
];

export const BIRTHDAY_TITLE = 'Happy Birthday, Pranati';

/** The birthday letter — exactly as written by Teja. */
export const BIRTHDAY_LETTER = {
  heading: 'To My Pranati ❤️',
  paragraphs: [
    'My dearest Pranati,',
    'Happy Birthday, my love!',
    'Do you remember March 17, 2023? That was the day our story began. I never knew that one day, someone would become such a beautiful and important part of my life.',
    "From that day until now, we've created so many memories. Some made us laugh, some made us smile, and some moments became special simply because we experienced them together.",
    'Today is extra special because this is the first time we are celebrating your birthday together. I wanted to make something different, something that you could experience, explore, and remember.',
    "That's why I created this little museum. Every picture, every video, every corner, and every little detail carries a piece of our journey.",
    'I may not be able to put all my feelings into words, but I hope this little world shows you how much you mean to me.',
    "I don't know what every tomorrow will look like, but I know that I want to keep creating beautiful memories with you, celebrating your happiness, sharing our dreams, and making more reasons to smile together.",
    'Thank you for coming into my life and making ordinary days feel special.',
    'Today, I wish you endless happiness, beautiful opportunities, good health, and everything your heart wishes for.',
    'Happy Birthday once again, Pranati!',
    "Here's to our first birthday celebration together, and to countless more beautiful memories waiting for us.",
  ],
  closing: ['With all my love,', 'Forever yours,', 'Teja ❤️'],
  footer: 'Our story began on March 17, 2023. And this is only the beginning...',
};
