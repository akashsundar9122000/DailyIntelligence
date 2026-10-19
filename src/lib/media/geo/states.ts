/**
 * Where to put the pin for a story about an Indian state: roughly the middle
 * of the state, as [longitude, latitude].
 *
 * A pin, not an outline. India's state boundaries are the Survey of India's,
 * and a line drawn from any other dataset risks disagreeing with them; a
 * point inside the state says "here" without drawing a line at all.
 * The country outline itself is Natural Earth's India-view set (countries.ts).
 */
export const STATE_PINS: Record<string, [number, number]> = {
  AP: [79.7, 15.9],
  AR: [94.7, 28.2],
  AS: [92.9, 26.2],
  BR: [85.3, 25.6],
  CT: [81.9, 21.3],
  GA: [74.1, 15.4],
  GJ: [71.2, 22.3],
  HR: [76.1, 29.1],
  HP: [77.2, 31.9],
  JH: [85.3, 23.6],
  KA: [75.7, 15.3],
  KL: [76.3, 10.5],
  MP: [78.7, 23.5],
  MH: [75.7, 19.7],
  MN: [93.9, 24.7],
  ML: [91.4, 25.5],
  MZ: [92.9, 23.2],
  NL: [94.6, 26.2],
  OR: [85.1, 20.5],
  PB: [75.3, 31.1],
  RJ: [74.2, 27.0],
  SK: [88.5, 27.5],
  TN: [78.7, 11.1],
  TG: [79.0, 18.1],
  TR: [91.7, 23.9],
  UP: [80.9, 26.8],
  UT: [79.0, 30.1],
  WB: [87.9, 22.9],
  DL: [77.1, 28.7],
  JK: [74.8, 33.8],
  LA: [77.6, 34.2],
  PY: [79.8, 11.9],
  CH: [76.8, 30.7],
};
