/**
 * Pairs and the patient each one is for.
 *
 * A pair is an R line and an L line side by side for the same patient, which
 * is how the builder adds them. Its patient name prints once, in front of the
 * pair. Pure, so the builder, the order page and the PDF group lines alike.
 */

export interface PairRead {
  eye: string | null;
  patient: string | null;
}

/** A name as it is stored and compared: trimmed, single-spaced. */
export function cleanPatient(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

function isPair(a: PairRead, b: PairRead): boolean {
  const oppositeEyes =
    (a.eye === "R" && b.eye === "L") || (a.eye === "L" && b.eye === "R");
  return oppositeEyes && cleanPatient(a.patient) === cleanPatient(b.patient);
}

/**
 * The lines in order, each group one line or a pair. Lines pair only when they
 * sit next to each other, one R and one L, under the same patient name.
 */
export function patientGroups<T>(
  lines: readonly T[],
  read: (line: T) => PairRead,
): T[][] {
  const groups: T[][] = [];
  for (let i = 0; i < lines.length; i++) {
    const first = lines[i];
    const next = lines[i + 1];
    if (next !== undefined && isPair(read(first), read(next))) {
      groups.push([first, next]);
      i++;
    } else {
      groups.push([first]);
    }
  }
  return groups;
}

/**
 * The patient name to print in front of each pair, keyed by the pair's first
 * line. Only a line with a lens (an eye) gets one; the name may be empty.
 */
export function patientHeads<T>(
  lines: readonly T[],
  read: (line: T) => PairRead,
): Map<T, string> {
  const heads = new Map<T, string>();
  for (const group of patientGroups(lines, read)) {
    const [first] = group;
    const { eye, patient } = read(first);
    if (eye === "R" || eye === "L") heads.set(first, cleanPatient(patient));
  }
  return heads;
}
