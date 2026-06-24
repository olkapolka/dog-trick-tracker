import { reviewCode } from './agent.js';

const exampleInput = {
  code: `function add(a, b) { return a + b; }`,
  language: 'JavaScript',
};

reviewCode(exampleInput).then(console.log).catch(console.error);
