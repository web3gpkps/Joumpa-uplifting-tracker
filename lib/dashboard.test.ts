import { describe, expect, test } from 'bun:test';
import { SYNTHETIC as D, SYNTHETIC_TODAY as TODAY } from './__fixtures__/synthetic';
import { TOTAL, actionProgress, bmiPeriodByStation, stationCodes, weeklyPerformance } from './aggregate';
import { berandaSummary, stationTodo } from './dashboard';
import { replacementTimeliness } from './rules';

const STATIONS = stationCodes(D.stations);

describe('beranda summary', () => {
  test('during the programme: totals agree with lib/aggregate', () => {
    const sum = berandaSummary(D, TODAY, STATIONS);
    expect(sum.phase).toBe('during');
    expect(sum.week).toBe(4); // 2 Nov 2026 is in week 4 (week 1 starts 12 Oct)
    expect(sum.bmiPeriod).toBe(2); // checks 12 Okt, 26 Okt, 9 Nov…

    const weekly = weeklyPerformance(D, 4).find((r) => r.key === TOTAL)!;
    expect([sum.total.assessed, sum.total.staffCount]).toEqual([weekly.assessed, weekly.staffCount]);
    const period = bmiPeriodByStation(D, 2).find((r) => r.key === TOTAL)!;
    expect(sum.total.bmiChecked).toBe(period.checked);

    const actions = actionProgress(D.actionItems, D.settings, TODAY).find((r) => r.key === TOTAL)!;
    expect(sum.total.actionOverdue).toBe(actions.overdue);
    expect(sum.actions.find((r) => r.key === TOTAL)).toEqual(actions);

    const named = D.replacements.filter((r) => r.replacedName);
    const open = named.filter((r) => ['OVERDUE', 'Menunggu'].includes(replacementTimeliness(r, D.settings, TODAY) ?? ''));
    expect([sum.total.replacementOpen, sum.total.replacementTotal]).toEqual([open.length, named.length]);
    expect(sum.total.replacementOverdue).toBe(2); // fixture: SUB Petugas B and CGK & HLP Petugas F
  });

  test('before the programme: no zeros posing as results', () => {
    const sum = berandaSummary(D, '2026-10-08', STATIONS);
    expect(sum.phase).toBe('before');
    expect(sum.week).toBeNull();
    expect(sum.bmiPeriod).toBeNull();
    expect(sum.stations.every((r) => r.assessed === null && r.bmiChecked === null)).toBe(true);
  });

  test('stations sorted worst first; CGK and HLP share the report group', () => {
    const sum = berandaSummary(D, TODAY, STATIONS);
    expect([...sum.stations.map((r) => r.station)].sort()).toEqual([...STATIONS].sort());
    const issues = sum.stations.map((r) => r.actionOverdue + r.replacementOverdue + r.tidakSesuai);
    expect(issues).toEqual([...issues].sort((a, b) => b - a));

    const cgk = sum.stations.find((r) => r.station === 'CGK')!;
    const hlp = sum.stations.find((r) => r.station === 'HLP')!;
    expect([cgk.group, cgk.sharedGroup]).toEqual(['CGK & HLP', true]);
    expect(hlp.actionOverdue).toBe(cgk.actionOverdue);
    expect(cgk.links.tindakLanjut).toEqual({ sheet: 'tindakLanjut', query: { laporan: 'CGK & HLP' } });
    expect(cgk.links.performa).toEqual({ sheet: 'performa', query: { stasiun: 'CGK', minggu: 4 } });
    expect(cgk.links.bmi).toEqual({ sheet: 'bmi', query: { stasiun: 'CGK', periode: 2 } });

    const sub = sum.stations.find((r) => r.station === 'SUB')!;
    expect(sub.sharedGroup).toBe(false);
    expect([sub.replacementOpen, sub.replacementTotal]).toEqual([1, 2]);
  });

  test('station to-do list for the running week', () => {
    const sub = { ...D, staff: D.staff.filter((s) => s.station === 'SUB'), stations: D.stations?.filter((s) => s.code === 'SUB') };
    const sum = berandaSummary(sub, TODAY, ['SUB']);
    const row = sum.stations[0];
    expect(row.staffCount).toBe(sub.staff.length);

    const items = stationTodo(sum, row, D.settings, false);
    expect(items.map((i) => i.key)).toEqual(['penilaian', 'bmi', 'tindak-lanjut', 'penggantian', 'temuan']);
    const tl = items.find((i) => i.key === 'tindak-lanjut')!;
    const subActions = actionProgress(D.actionItems, D.settings, TODAY, ['SUB']).find((r) => r.key === 'SUB')!;
    expect(tl.overdue).toBe(subActions.overdue);
    expect(tl.state).toBe(subActions.overdue + subActions.dueSoon > 0 ? 'todo' : 'done');
    expect(items.find((i) => i.key === 'temuan')!.link).toEqual({ sheet: 'laporan', query: { stasiun: 'SUB', minggu: 4 } });
    expect(stationTodo(sum, row, D.settings, true).find((i) => i.key === 'temuan')!.state).toBe('done');
  });

  test('before week 1 the list is a preparation list', () => {
    const sum = berandaSummary(D, '2026-10-08', ['SUB']);
    const items = stationTodo(sum, sum.stations[0], D.settings, false, 3);
    expect(items.map((i) => i.key)).toEqual(['lp', 'tindak-lanjut', 'penggantian', 'penilaian', 'bmi']);
    expect(items.find((i) => i.key === 'penilaian')!.detail).toBe('Mulai Senin, 12 Okt 2026');
    expect(items.find((i) => i.key === 'bmi')!.state).toBe('later');
  });

  test('after the programme the weekly numbers refer to the last week', () => {
    const sum = berandaSummary(D, '2027-01-15', STATIONS);
    expect(sum.phase).toBe('after');
    expect(sum.week).toBe(D.settings.weeks);
  });
});
