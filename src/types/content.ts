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
  year: number;
  role: string;
  org: string;
  segment: Segment['id'];
  highlight: string;
}

export type SkillGroup = 'languages' | 'backend' | 'frontend' | 'data' | 'devops' | 'tools';

export interface Skill {
  name: string;
  group: SkillGroup;
  years: number;
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
