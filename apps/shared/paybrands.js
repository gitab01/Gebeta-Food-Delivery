import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { Icon } from './brand';

/**
 * The payment brands a customer can save, in the order the picker shows them.
 * `mpesa` and `cbebir` are the two mobile/bank rails an Addis customer actually uses;
 * the same list is the enum on the backend, so adding one means editing both.
 */
export const PAY_BRANDS = ['card', 'telebirr', 'mpesa', 'cbebir', 'cash'];

/** Fallback glyph for the rails that are ours rather than someone else's brand. */
export const PAY_GLYPH = { card: 'card', cash: 'money' };

const TELEBIRR_BLUE = '#1d7fc1';
const MPESA_GREEN = '#22a038';
const MPESA_LEAF = '#7cc24a';
const MPESA_RED = '#e4002b';
const CBE_GOLD = '#b8934a';
const CBE_DEEP = '#7a5c22';

/**
 * Simplified versions of each provider's own mark, drawn to a 32×32 box so they sit on
 * one baseline at 26px. They keep the provider's colours rather than the app palette:
 * a payment rail is recognised by its brand, not by ours.
 */
function Telebirr() {
  const strokes = { fill: 'none', stroke: TELEBIRR_BLUE, strokeLinecap: 'round' };
  return (
    <>
      <Path {...strokes} d="M18 3.5V20" strokeWidth="3" />
      <Path {...strokes} d="M18 8.5C14.5 7.6 11.8 9.2 10.2 12.4" strokeWidth="2.8" />
      <Path
        {...strokes}
        strokeWidth="2.8"
        d="M18 13C24.4 13 27.8 17.6 26.2 22.4C24.6 27.2 19 29.2 15.2 26.8C11.6 24.6 11.8 19.6 15.4 18.2C18 17.2 20.6 18.8 20.8 21.4"
      />
    </>
  );
}

function MPesa() {
  return (
    <>
      <Circle cx="16" cy="16" r="14" fill={MPESA_GREEN} />
      <Rect x="11.8" y="6" width="8.6" height="20" rx="2.4" fill={MPESA_LEAF} />
      <Path d="M13.4 14.9H18.2V12.3L22.8 14.9L18.2 17.5V14.9H13.4Z" fill={MPESA_RED} />
      <Path d="M13.4 21.4H19.6" stroke={MPESA_LEAF} strokeWidth="1.4" strokeLinecap="round" opacity="0.5" />
    </>
  );
}

function Cbe() {
  const feather = { fill: 'none', stroke: CBE_GOLD, strokeWidth: 1.6, strokeLinecap: 'round' };
  return (
    <>
      <Path {...feather} d="M15.5 4.5C23.6 4.6 28.9 10.2 28.4 17.6" opacity="0.55" />
      <Path {...feather} d="M16.6 8C22.8 8.1 26.6 12.2 26.1 17.6" opacity="0.8" />
      <Path {...feather} d="M17.6 11.3C21.7 11.4 23.9 13.8 23.5 17.4" />
      <Circle cx="13.8" cy="19.2" r="9.2" fill={CBE_GOLD} />
      <Circle cx="13.8" cy="19.2" r="6.6" fill="none" stroke={CBE_DEEP} strokeWidth="1.3" />
      <Circle cx="13.8" cy="19.2" r="2.4" fill={CBE_DEEP} opacity="0.75" />
    </>
  );
}

const MARKS = { telebirr: Telebirr, mpesa: MPesa, cbebir: Cbe };

/** A saved rail, at the size a list row or a picker chip needs. */
export function PayMark({ brand, size = 26, color }) {
  const Mark = MARKS[brand];
  if (!Mark) return <Icon name={PAY_GLYPH[brand] || 'card'} size={size * 0.78} color={color} />;
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" accessibilityLabel={brand} accessibilityRole="image">
      <Mark />
    </Svg>
  );
}
