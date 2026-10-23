export interface Segment {
  id: string; // 'datacenters'
  title: string; // 'Datacenters'
  years: string; // '2001–2012'
  summary: string;
  responsibilities: string[];
  platforms: string[]; // 'VMware vSphere', 'Cisco UCS'
  outcomes: string[]; // measurable results
}

export interface Milestone {
  start: number; // sort key (year)
  period: string; // shown on the card, e.g. 'Dec 2020 – Present'
  chip?: string; // short label for the year button; defaults to `start`
  role: string;
  org: string;
  segment?: Segment['id']; // links the card to a layer of the Stack
  highlights: string[];
}

export type SkillGroup = 'languages' | 'backend' | 'frontend' | 'data' | 'devops' | 'tools';

export interface Skill {
  name: string;
  group: SkillGroup;
  years?: number; // hands-on years; hidden when absent
  projects: string[]; // project slugs
}

export interface Project {
  slug: string; // 'safyaclinic' -> #work/safyaclinic
  title: string;
  tagline: string;
  role: string[];
  stack: string[]; // skill names
  tags: string[]; // filter chips
  challenge: string;
  solution: string;
  result: string;
  demoUrl?: string;
  sourceUrl?: string;
  credentials?: { username: string; password: string; note: string };
  media: {
    poster: string;
    previewMp4?: string;
    previewWebm?: string;
    screenshots: { src: string; alt: string; caption: string }[];
  };
}
