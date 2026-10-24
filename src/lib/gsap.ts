import { gsap } from 'gsap';
import { Flip } from 'gsap/Flip';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Register plugins once; every module imports GSAP from here.
gsap.registerPlugin(ScrollTrigger, Flip);

export { gsap, Flip, ScrollTrigger };
