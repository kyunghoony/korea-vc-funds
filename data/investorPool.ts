export interface Investor {
  id: string;
  name: string;
  logo: string;
  description_ko: string;
  description_en: string;
  contactEmail: string;
}

export const INVESTOR_POOL: Investor[] = [
  {
    id: 'fast-ventures',
    name: 'Fast Ventures',
    logo: '/images/investors/fast-ventures.png',
    description_ko: 'Seed ~ Series A | Software, AI, Consumer',
    description_en: 'Seed ~ Series A | Software, AI, Consumer',
    contactEmail: 'contact@vcreview.xyz',
  },
];
