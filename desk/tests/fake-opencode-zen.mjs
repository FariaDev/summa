import fs from 'node:fs';

/* Catálogo do provedor `opencode` dos fakes (#44). Como o servidor real, os
   modelos do Zen só aparecem quando `OPENCODE_API_KEY` está no ambiente. `cost`
   zero = grátis; `cat-jam-free` está no catálogo mas não na lista ao vivo do
   console falso (o aviso "Pode ter saído do plano gratuito"); `jev-1.13-free`
   é o que a Mesa tira da lista. Nenhuma inferência: o fake só responde o
   catálogo e grava, sem a chave, que ela chegou. */
const FREE = {input: 0, output: 0, cacheRead: 0, cacheWrite: 0};
const PAID = {input: 2.5, output: 15, cacheRead: 0.25, cacheWrite: 0};
const model = (id, name, cost) => ({provider: 'opencode', id, name, input: ['text', 'image'], cost});

export const ZEN_MODELS = [
  model('deepseek-v4.1-flash-free', 'DeepSeek V4.1 Flash Free', FREE),
  model('glm-5.3-flash-free', 'GLM 5.3 Flash Free', FREE),
  model('big-pickle', 'Big Pickle', FREE),
  model('nemotron-3-ultra-free', 'Nemotron 3 Ultra Free', FREE),
  model('muse-spark-1.3-contributor-free', 'Muse Spark Contributor Free', FREE),
  model('cat-jam-free', 'Cat Jam Free', FREE),
  model('jev-1.13-free', 'JEV 1.13 Free', FREE),
  model('gpt-5.5', 'GPT 5.5', PAID),
];

/** Os modelos do Zen que o fake do motor oferece com este ambiente. */
export const zenModelsFor = (env) => (env.FAKE_OPENCODE_ZEN === '1' && env.OPENCODE_API_KEY ? ZEN_MODELS : []);

/** `--provider opencode --model <id>` dos argumentos de lançamento, ou null. */
export function launchModelFrom(args, models) {
  const provider = args[args.indexOf('--provider') + 1];
  const id = args[args.indexOf('--model') + 1];
  return args.includes('--provider') ? models.find((m) => m.provider === provider && m.id === id) || null : null;
}

/** Uma linha por lançamento: chegou chave? com quantos caracteres? ela veio na linha de comando? e quais argumentos. Nunca a chave. */
export function recordLaunch(file, env, args) {
  if (!file) return;
  const key = env.OPENCODE_API_KEY || '';
  fs.appendFileSync(file, JSON.stringify({keyPresent: key !== '', keyLength: key.length, keyInArgs: key !== '' && args.some((a) => String(a).includes(key)), args: args.filter((a) => !key || !String(a).includes(key))}) + '\n');
}
