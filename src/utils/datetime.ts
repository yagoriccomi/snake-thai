/** Utilitários de data/hora para o módulo de Aulas. */
import { onlyDigits } from '@/utils/masks';

const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const;

/** Preenche com zero à esquerda. */
function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

/**
 * Combina uma data `DD/MM/AAAA` e uma hora `HH:MM` num timestamp ISO (UTC).
 * Retorna `null` se a data/hora for incompleta ou inexistente no calendário.
 */
export function combineDateTimeToIso(dateBr: string, time: string): string | null {
  const dateDigits = onlyDigits(dateBr);
  const timeDigits = onlyDigits(time);
  if (dateDigits.length !== 8 || timeDigits.length !== 4) {
    return null;
  }
  const day = Number(dateDigits.slice(0, 2));
  const month = Number(dateDigits.slice(2, 4));
  const year = Number(dateDigits.slice(4, 8));
  const hour = Number(timeDigits.slice(0, 2));
  const minute = Number(timeDigits.slice(2, 4));
  if (hour > 23 || minute > 59) {
    return null;
  }
  const date = new Date(year, month - 1, day, hour, minute, 0, 0);
  const isRealDate =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day;
  if (!isRealDate) {
    return null;
  }
  return date.toISOString();
}

/** Formata a hora de um ISO como `HH:MM` (fuso local). */
export function formatTime(iso: string): string {
  const date = new Date(iso);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Formata a data de um ISO como `DD/MM` (fuso local). */
export function formatDayMonth(iso: string): string {
  const date = new Date(iso);
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`;
}

/** Abreviação do dia da semana de um ISO. */
export function formatWeekday(iso: string): string {
  return WEEKDAYS_SHORT[new Date(iso).getDay()] ?? '';
}

/** Formata um ISO como `Ter, 28/07 • 19:00`. */
export function formatFullDateTime(iso: string): string {
  return `${formatWeekday(iso)}, ${formatDayMonth(iso)} • ${formatTime(iso)}`;
}

/** Limites `[início, fim)` do dia informado, em ISO — para filtrar por data. */
export function dayBoundsIso(date: Date): { startIso: string; endIso: string } {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 0, 0, 0, 0);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

/** Item de dia usado pela faixa horizontal de navegação (calendário). */
export interface DayItem {
  /** Chave estável (data em ISO curto `AAAA-MM-DD`). */
  key: string;
  date: Date;
  weekday: string;
  day: string;
  isToday: boolean;
}

/** Constrói uma faixa de `count` dias a partir de `start`. */
export function buildDayStrip(start: Date, count: number): DayItem[] {
  const today = new Date();
  const todayKey = isoDateKey(today);
  const items: DayItem[] = [];
  for (let offset = 0; offset < count; offset += 1) {
    const date = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate() + offset,
    );
    const key = isoDateKey(date);
    items.push({
      key,
      date,
      weekday: WEEKDAYS_SHORT[date.getDay()] ?? '',
      day: pad(date.getDate()),
      isToday: key === todayKey,
    });
  }
  return items;
}

/** Chave curta `AAAA-MM-DD` de uma data (fuso local). */
export function isoDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
