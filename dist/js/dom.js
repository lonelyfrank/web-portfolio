// Utility DOM e nodi stabili condivisi dai moduli.
import { SECTIONS } from './config.js';

export const $ = (selector, scope = document) => scope.querySelector(selector);
export const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

export function translateOf(node, axis) {
  const matrix = new DOMMatrixReadOnly(getComputedStyle(node).transform);
  return axis === 'y' ? matrix.m42 : matrix.m41;
}

export const root = document.documentElement;
export const main = $('main');
export const pages = $$('.page');
export const navLinks = $$('.site-nav a');
export const dialog = $('#detail');
export const strip = $('.journey-strip');
export const track = $('.bridge-track');
export const avatar = $('#avatar');
export const stationNodes = SECTIONS.map(id => $(`[data-station="${id}"]`));

// Pixel per unità di scena: lo sprite a riposo è largo 128 su.
export function unit() { return avatar.offsetWidth / 128; }
