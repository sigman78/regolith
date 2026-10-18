import { startApp } from '@/editor/app';

const canvas = document.getElementById('view');
if (!(canvas instanceof HTMLCanvasElement)) throw new Error('missing #view canvas');
startApp(canvas);
