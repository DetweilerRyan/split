#!/usr/bin/env node
// Zero-dependency SplitSmart link generator.
// Usage: node generate-link.mjs '<seed json>'   or   echo '<seed json>' | node generate-link.mjs
// Embeds the reference lz-string (MIT, pieroxy) URI-safe codec so no npm install is needed.
import { randomUUID } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

const APP_URL = 'https://detweilerryan.github.io/split/';
const KEY = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-$';
const UUID_V4 = /^urn:split:room:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function compress(input, bitsPerChar, getChar) {
  if (input == null) return '';
  const dict = new Map();
  const dictCreate = new Set();
  let w = '';
  let enlargeIn = 2;
  let dictSize = 3;
  let numBits = 2;
  const out = [];
  let val = 0;
  let pos = 0;

  const writeBit = (bit) => {
    val = (val << 1) | bit;
    if (pos === bitsPerChar - 1) {
      pos = 0;
      out.push(getChar(val));
      val = 0;
    } else pos++;
  };
  const writeBits = (n, value) => {
    for (let i = 0; i < n; i++) {
      writeBit(value & 1);
      value >>= 1;
    }
  };
  const tick = () => {
    if (--enlargeIn === 0) {
      enlargeIn = 2 ** numBits;
      numBits++;
    }
  };
  const emitNew = (c) => {
    const code = c.charCodeAt(0);
    if (code < 256) {
      writeBits(numBits, 0);
      writeBits(8, code);
    } else {
      writeBits(numBits, 1);
      writeBits(16, code);
    }
    tick();
    dictCreate.delete(c);
  };
  const emitW = () => {
    if (dictCreate.has(w)) emitNew(w);
    else writeBits(numBits, dict.get(w));
    tick();
  };

  for (let i = 0; i < input.length; i++) {
    const c = input.charAt(i);
    if (!dict.has(c)) {
      dict.set(c, dictSize++);
      dictCreate.add(c);
    }
    const wc = w + c;
    if (dict.has(wc)) {
      w = wc;
    } else {
      emitW();
      dict.set(wc, dictSize++);
      w = c;
    }
  }
  if (w !== '') emitW();

  writeBits(numBits, 2);
  for (;;) {
    val <<= 1;
    if (pos === bitsPerChar - 1) {
      out.push(getChar(val));
      break;
    }
    pos++;
  }
  return out.join('');
}

function decompress(length, resetValue, getNextValue) {
  const dictionary = [0, 1, 2];
  let enlargeIn = 4;
  let dictSize = 4;
  let numBits = 3;
  let entry = '';
  const result = [];
  const data = { val: getNextValue(0), position: resetValue, index: 1 };

  const readBits = (n) => {
    let bits = 0;
    let power = 1;
    const max = 2 ** n;
    while (power !== max) {
      const resb = data.val & data.position;
      data.position >>= 1;
      if (data.position === 0) {
        data.position = resetValue;
        data.val = getNextValue(data.index++);
      }
      bits |= (resb > 0 ? 1 : 0) * power;
      power <<= 1;
    }
    return bits;
  };
  const tick = () => {
    if (--enlargeIn === 0) {
      enlargeIn = 2 ** numBits;
      numBits++;
    }
  };

  const first = readBits(2);
  if (first === 2) return '';
  if (first > 2) return null;
  let w = String.fromCharCode(readBits(first === 0 ? 8 : 16));
  dictionary[3] = w;
  result.push(w);

  for (;;) {
    if (data.index > length) return '';
    let c = readBits(numBits);
    if (c === 0 || c === 1) {
      dictionary[dictSize++] = String.fromCharCode(readBits(c === 0 ? 8 : 16));
      c = dictSize - 1;
      enlargeIn--;
    } else if (c === 2) {
      return result.join('');
    }
    if (enlargeIn === 0) {
      enlargeIn = 2 ** numBits;
      numBits++;
    }
    if (dictionary[c]) entry = dictionary[c];
    else if (c === dictSize) entry = w + w.charAt(0);
    else return null;
    result.push(entry);
    dictionary[dictSize++] = w + entry.charAt(0);
    enlargeIn--;
    w = entry;
    if (enlargeIn === 0) {
      enlargeIn = 2 ** numBits;
      numBits++;
    }
  }
}

export function compressToEncodedURIComponent(input) {
  if (input == null) return '';
  return compress(input, 6, (a) => KEY.charAt(a));
}

export function decompressFromEncodedURIComponent(input) {
  if (input == null) return '';
  if (input === '') return null;
  const s = input.replace(/ /g, '+');
  return decompress(s.length, 32, (index) => KEY.indexOf(s.charAt(index)));
}

export function validateSeed(seed) {
  const errors = [];
  const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
  if (!seed || typeof seed !== 'object' || Array.isArray(seed)) throw new Error('Seed must be a JSON object');
  if (typeof seed.title !== 'string') errors.push('title must be a string');
  for (const k of ['cardTipEur', 'cashTipEur', 'bankUsd']) {
    if (!isNum(seed[k])) errors.push(`${k} must be a finite number`);
  }
  if (!Array.isArray(seed.roster) || !seed.roster.every((r) => typeof r === 'string')) {
    errors.push('roster must be an array of strings');
  }
  if (!Array.isArray(seed.items)) {
    errors.push('items must be an array');
  } else {
    const ids = new Set();
    seed.items.forEach((item, i) => {
      if (!item || typeof item !== 'object') return errors.push(`items[${i}] must be an object`);
      for (const k of ['id', 'name', 'en']) {
        if (typeof item[k] !== 'string') errors.push(`items[${i}].${k} must be a string`);
      }
      if (ids.has(item.id)) errors.push(`items[${i}].id "${item.id}" is duplicated`);
      ids.add(item.id);
      if (!isNum(item.eur)) errors.push(`items[${i}].eur must be a finite number`);
    });
  }
  if (errors.length) throw new Error(`Invalid seed:\n- ${errors.join('\n- ')}`);
  return seed;
}

export function generateLink(seed, roomId = `urn:split:room:${randomUUID()}`) {
  validateSeed(seed);
  if (!UUID_V4.test(roomId)) throw new Error('Room ID must be urn:split:room:<uuid v4>');
  const room = Buffer.from(roomId, 'utf8').toString('base64url');
  const seedParam = compressToEncodedURIComponent(JSON.stringify(seed));
  const url = new URL(APP_URL);
  url.hash = new URLSearchParams({ room, seed: seedParam }).toString();

  const params = new URLSearchParams(new URL(url.href).hash.slice(1));
  const decodedRoom = Buffer.from(params.get('room'), 'base64url').toString('utf8');
  const decodedSeed = JSON.parse(decompressFromEncodedURIComponent(params.get('seed')));
  if (decodedRoom !== roomId || !UUID_V4.test(decodedRoom)) throw new Error('Room ID verification failed');
  if (!isDeepStrictEqual(decodedSeed, seed)) throw new Error('Seed verification failed');
  return url.href;
}

function main() {
  const arg = process.argv[2];
  const raw = arg ?? readFileSync(0, 'utf8');
  let seed;
  try {
    seed = JSON.parse(raw);
  } catch (e) {
    console.error(`Seed is not valid JSON: ${e.message}`);
    process.exit(1);
  }
  try {
    console.log(generateLink(seed));
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
