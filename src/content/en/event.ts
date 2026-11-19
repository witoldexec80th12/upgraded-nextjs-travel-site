// Import the canonical refund policy from ticket-schema so the FAQ answer,
// Offer.description, and MerchantReturnPolicy.description are always identical.
// ticket-schema.ts only imports a `type` from this file, so there is no
// circular runtime dependency.
import { REFUND_POLICY } from '../../lib/ticket-schema';

export type TicketType = {
  id: string;
  title: string;
  details: string;
  hours: string;
  image: string;
  adultPrice: number;
  childPrice: number;
  /** Mark true to display this tier first with a "Most Popular" badge. */
  recommended?: boolean;
};

export type FaqItem = {
  q: string;
  a: string;
};

export type ActivityItem = {
  title: string;
  description: string;
  status?: string;
};

export type OpeningHoursSpec = {
  /** schema.org day names, e.g. ["Monday", "Tuesday"]. */
  dayOfWeek: string[];
  /** 24h "HH:MM", e.g. "09:00". */
  opens: string;
  closes: string;
};

export type SeoConfig = {
  /**
   * Absolute production URL, no trailing slash (e.g. "https://my-event.com").
   * Required for correct canonical/hreflang/OG tags -- update before going
   * live. A placeholder here will make every SEO tag point at the wrong domain.
   */
  siteUrl: string;
  /** Which JSON-LD entity best describes this venue. */
  businessType: 'TouristAttraction' | 'LocalBusiness';
  geo?: { latitude: number; longitude: number };
  openingHours?: OpeningHoursSpec[];
  social?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    tiktok?: string;
  };
  /**
   * Per-page meta descriptions. Falls back to on-page copy (hero subtitle,
   * FAQ note, etc.) when a key is omitted -- fill these in once real content
   * exists rather than leaving generic fallback text long-term.
   */
  metaDescriptions?: Partial<
    Record<
      'home' | 'schedule' | 'faq' | 'activities' | 'contact' | 'terms' | 'privacy' | 'cookies',
      string
    >
  >;
};

export type DiscoverArticle = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string[];
};

export type EventConfig = {
  /**
   * Honest scarcity signal displayed on the ticket section.
   * Set to a factual string when true (e.g. "Summer slots typically fill
   * 2–3 hours ahead — book early") or null to hide the notice.
   * Only show statements that are actually true for your venue.
   */
  scarcityNote?: string | null;
  brand: {
    name: string;
    logoText: string;
    logoUrl?: string;
    colors: {
      background: string;
      foreground: string;
      primary: string;
      primaryForeground: string;
      headerBg: string;
      headerText: string;
      footerBg: string;
      footerText: string;
      accent: string;
    };
    fontSans: string;
    fontSerif: string;
  };
  hero: {
    badge: string;
    title: string;
    subtitle: string;
    ctaLabel: string;
    heroImage: string;
  };
  ticketTypes: TicketType[];
  faq: {
    heading: string;
    mandatoryNote: string;
    items: FaqItem[];
  };
  activities: {
    heading: string;
    subtitle: string;
    items: ActivityItem[];
  };
  location: {
    name: string;
    address: string;
    mapEmbedUrl: string;
    gettingThereBullets: { icon: string; label: string }[];
  };
  contact: {
    heading: string;
    description: string[];
    email: string;
    phone: string;
    formRecipientNote: string;
  };
  legalEntity: {
    companyName: string;
    address: string;
    email: string;
  };
  seo: SeoConfig;
  discoverArticles: DiscoverArticle[];
};

export const eventConfig: EventConfig = {
  // Honest scarcity signal — set to null to hide, or a factual string when true.
  // Only display statements that are actually verified for your venue.
  scarcityNote: 'Summer afternoon slots typically fill 2–3 hours ahead — book early to secure your preferred time.',

  brand: {
    name: "The Royal Castle",
    logoText: "Royal Castle",
    colors: {
      background: "0 0% 98%",      // #fafafa
      foreground: "240 10% 3.9%",  // #09090b
      primary: "220 50% 30%",      // Deep blue
      primaryForeground: "0 0% 98%",
      headerBg: "0 0% 100%",
      headerText: "220 50% 30%",
      footerBg: "240 10% 3.9%",
      footerText: "0 0% 90%",
      accent: "38 92% 50%",        // Orange/gold
    },
    fontSans: "'Jost', sans-serif",
    fontSerif: "'Cormorant Garamond', serif",
  },
  hero: {
    badge: "Online Booking Only",
    title: "Experience the Royal Castle",
    subtitle: "Step into history and explore the magnificent halls and gardens of the realm's most iconic fortress.",
    ctaLabel: "Purchase Tickets",
    heroImage: "/hero.jpg",
  },
  ticketTypes: [
    {
      id: "full",
      title: "Full Castle Access",
      details: "Includes access to the State Rooms, King's Quarters, and the Royal Gardens.",
      hours: "Open 9AM–6PM Daily",
      image: "/full-ticket.jpg",
      adultPrice: 25,
      childPrice: 0,
      recommended: true,
    },
    {
      id: "gardens",
      title: "Royal Gardens Only",
      details: "Includes access to the Royal Gardens and the Outer Courtyard. Castle interior not included.",
      hours: "Open 9AM–6PM Daily",
      image: "/courtyard-ticket.jpg",
      adultPrice: 10,
      childPrice: 0,
    },
  ],
  faq: {
    heading: "Frequently Asked Questions",
    mandatoryNote: "Online booking is mandatory. Tickets are available ONLINE ONLY.",
    items: [
      {
        q: "Why should I book before visiting Casa di Guilietta?",
        a: "Online booking for the visit is mandatory. There is no booking at a physical ticket queue for Casa di Guilietta and Juliet's Balcony. In 2025 this was instituted. As availability gets filled and is often sold out the day of your visit, its recommended to book in advance."
      },
      {
        q: "How far in advance should I book?",
        a: "It's recommended to book your slot at least one week in advance, particularly in peak season, as you plan your trip as availabilities can be a bit low."
      },
      {
        q: "When is the house closed?",
        a: "Closed on December 25 and January 1. Mondays hours are reduced, from 14:00 to 19:00."
      },
      {
        q: "What is the distinction between the two different entries for the tickets?",
        a: "Beginning on April 1, 2026 there will be 2 ticket tiers - one ticket that limits access to Juliet's Balcony, letting you visit the courtyard and Teatro Nuovo in Piazzetta Navona, and one ticket that provides the full experience with a visit to Juliet's House and Balcony."
      },
      {
        q: "Where is the entrance for Juliet's Balcony?",
        a: "From April 1, 2026, entrance for tickets is moved to Teatro Nuovo in Piazzetta Navona. The visit starts in Teatro Nuovo and ends in Via Cappello, passing through the theater and into the courtyard. If you have booked the Full Ticket, you then pass into the house and Juliet's balcony, before exiting on Via Cappello."
      },
      {
        q: "How much time do you have for this visit?",
        a: "It is recommended to arrive 15 minutes early and allow 30-60 minutes for your visit. The last daily ticket to the house is at 18.30, please enter from Piazzetta Navona by 18:35."
      },
      {
        q: "What are Juliet's letters? How may I leave one?",
        a: "Letters to Juliet of Verona have been left for over 90 years at Casa di Guilietta. You can leave them in the mailbox. Please make sure to provide a return address as well!"
      },
      {
        q: "What is the reduced accessibility policy for Juliet's House and Balcony?",
        a: "Valid for persons who hold a Disability Card and for their companion, but access may be limited to the courtyard and ground floor due to the Emergency Plan at stake."
      },
      {
        q: "Are dogs allowed in Juliet's House and Balcony?",
        a: "Dogs are not allowed in Juliet's house. However, small dogs can enter the courtyard if they are kept in a small bag or pet carrier."
      },
      {
        q: "Can I get a refund or change my visit date?",
        a: REFUND_POLICY,
      }
    ]
  },
  activities: {
    heading: "Activities & Experiences",
    subtitle: "Enhance your visit with these curated experiences.",
    items: [
      {
        title: "Audio Guide Tour",
        description: "Immerse yourself in history with our comprehensive audio guide, available in 6 languages.",
        status: "Available at entrance"
      },
      {
        title: "Behind the Scenes",
        description: "Access restricted areas including the ancient wine cellars and hidden passages.",
        status: "Coming Soon"
      }
    ]
  },
  location: {
    name: "The Royal Castle",
    address: "1 Castle Hill, Historic District, 12345 City",
    mapEmbedUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2624.9916256937586!2d2.292292615674404!3d48.85837007928746!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x47e66e2964e34e2d%3A0x8ddca9ee380ef7e0!2sEiffel%20Tower!5e0!3m2!1sen!2sus!4v1680108398869!5m2!1sen!2sus",
    gettingThereBullets: [
      { icon: "bus", label: "Bus routes 12, 15, and 24 stop directly outside." },
      { icon: "train", label: "Central Station is a 15-minute walk away." },
      { icon: "car", label: "Limited paid parking available nearby." }
    ]
  },
  contact: {
    heading: "Contact Us",
    description: [
      "Every year, millions visit Verona to learn more of the love story of Romeo and Juliet, walk the streets, visit the homes and leave a letter for Juliet. We invite you to discover the magic of Verona, and immerse yourself in the love story of Romeo and Juliet in your visit.",
      "If you have not received your tickets, please check your different inbox folders, including Social and Spam folders. Should you need to contact us for any reason you can do so below:"
    ],
    email: "customerservice@50pomodoros.com",
    phone: "",
    formRecipientNote: "Helpful official links for the website can be found below."
  },
  legalEntity: {
    companyName: "50 Pomodoros Incorporated",
    address: "",
    email: "info@50pomodoros.com"
  },
  discoverArticles: [
    {
      id: "article-1",
      slug: "article-1",
      title: "Article 1",
      excerpt: "This is the excerpt for article 1. It will be replaced with the real article content.",
      body: [
        "This is the first paragraph of article 1. It will be replaced with the real article content.",
        "This is the second paragraph of article 1. It will be replaced with the real article content.",
        "This is the third paragraph of article 1. It will be replaced with the real article content.",
      ],
    },
    {
      id: "article-2",
      slug: "article-2",
      title: "Article 2",
      excerpt: "This is the excerpt for article 2. It will be replaced with the real article content.",
      body: [
        "This is the first paragraph of article 2. It will be replaced with the real article content.",
        "This is the second paragraph of article 2. It will be replaced with the real article content.",
        "This is the third paragraph of article 2. It will be replaced with the real article content.",
      ],
    },
    {
      id: "article-3",
      slug: "article-3",
      title: "Article 3",
      excerpt: "This is the excerpt for article 3. It will be replaced with the real article content.",
      body: [
        "This is the first paragraph of article 3. It will be replaced with the real article content.",
        "This is the second paragraph of article 3. It will be replaced with the real article content.",
        "This is the third paragraph of article 3. It will be replaced with the real article content.",
      ],
    },
  ],
  seo: {
    // TODO before going live: replace with the real production domain.
    // Every canonical/hreflang/OG tag is built from this value.
    siteUrl: "https://example.com",
    businessType: "TouristAttraction",
    geo: { latitude: 48.8584, longitude: 2.2945 },
    openingHours: [
      {
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
        opens: "09:00",
        closes: "18:00",
      },
    ],
    social: {
      // facebook: "https://facebook.com/yourpage",
      // instagram: "https://instagram.com/yourpage",
    },
    metaDescriptions: {
      home: "Book official tickets for the Royal Castle online. Skip the line with mandatory advance booking for the State Rooms, King's Quarters, and Royal Gardens.",
      faq: "Answers to common questions about visiting the Royal Castle: booking rules, opening hours, ticket differences, and accessibility.",
      activities: "Curated experiences to enhance your Royal Castle visit, including audio guides and behind-the-scenes access.",
      contact: "Contact the Royal Castle ticketing team for booking support, group inquiries, or accessibility questions.",
    },
  },
};
